const { query, run } = require('./database');
const { suggestPlacement, placeItems } = require('./placementAlgorithm');

const { parse } = require('csv-parse/sync');

class CargoService {
    
    async importItems(file) {
        const items = parse(file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        await run('DELETE FROM items');

        for (const item of items) {
            await run(`
                INSERT OR REPLACE INTO items (itemId, name, width, depth, height, priority, expiryDate, usageLimit, preferredZone)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                item.itemId?.trim() || '',
                item.name?.trim() || '',
                Number(item.width) || 0,
                Number(item.depth) || 0,
                Number(item.height) || 0,
                Number(item.priority) || 0,
                item.expiryDate?.trim() || 'N/A',
                Number(item.usageLimit) || 0,
                item.preferredZone?.trim() || ''
            ]);
        }
    
        return { message: `${items.length} items imported` };
    }
    
    
    async importContainers(file) {
        const containers = parse(file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
    
        for (const container of containers) {
            await run(`
                INSERT OR REPLACE INTO containers (containerId, zone, width, depth, height, usedVolume)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                container.containerId?.trim() || '',
                container.zone?.trim() || '',
                Number(container.width) || 0,
                Number(container.depth) || 0,
                Number(container.height) || 0,
                Number(container.usedVolume) || 0
              ]);
              
        }
    
        return { message: `${containers.length} containers imported` };
    }


    async placeItem(item, location) {
        // Update item's containerId in the database
        await run(
            'UPDATE items SET containerId = ? WHERE itemId = ?',
            [location.containerId, item.itemId]
        );
    
        // Calculate volume of the item (assuming rectangular)
        const itemVolume = item.width * item.depth * item.height;
    
        // Update the container's used volume
        await run(
            'UPDATE containers SET usedVolume = usedVolume + ? WHERE containerId = ?',
            [itemVolume, location.containerId]
        );
    
        // Log the action
        await this.logAction('place', item.itemId, 'system');
    
        return { success: true };
    }
    
    //async getStorageLayout() {
    //    const containers = await query('SELECT * FROM containers');
    //    const items = await query('SELECT * FROM items');
    //    return { containers, items };
    //}
    
    async getStorageLayout() {
        const containers = await query('SELECT * FROM containers');
        const items = await query('SELECT * FROM items');
    
        const containerMap = new Map();
    
        for (const item of items) {
            if (!containerMap.has(item.containerId)) {
                containerMap.set(item.containerId, []);
            }
            containerMap.get(item.containerId).push(item);
        }
    
        const layout = containers.map(container => {
            const containerVolume = container.width * container.depth * container.height;
            const usedVolume = container.usedVolume || 0;
            const remainingVolume = containerVolume - usedVolume;
    
            return {
                containerId: container.containerId,
                zone: container.zone,
                size: remainingVolume,
                empty: usedVolume === 0,
                location: { containerId: container.containerId }
            };
        });
    
        return layout;
    }
    

async addItemToStorage(item) {
    const containers = await query('SELECT * FROM containers');
    const storageLayout = { containers };
    const suggestion = suggestPlacement(item, storageLayout);
    

  if (suggestion.action === 'place') {
    await this.placeItem(item, suggestion.location);
    return {
      status: 'success',
      location: suggestion.location,
      message: suggestion.reason
    };
  }

  return {
    status: 'failed',
    message: suggestion.reason
  };
}

    

    async placeItems(data) {
        // Pull all unplaced items if not passed in
        const items = data.items || await query('SELECT * FROM items WHERE containerId IS NULL');
        
        // Pull containers and cast usedVolume to number
        const rawContainers = data.containers || await query('SELECT * FROM containers');
        const containers = rawContainers.map(container => ({
            ...container,
            usedVolume: Number(container.usedVolume) || 0
        }));
    
        // Run placement algorithm
        const { placements } = placeItems(items, containers);
    
        // Apply placement and update DB
        for (const placement of placements) {
            await run(
                'UPDATE items SET containerId = ? WHERE itemId = ?',
                [placement.containerId, placement.itemId]
            );
    
            // Calculate and update usedVolume
            const itemVolume = placement.position.endCoordinates.width *
                               placement.position.endCoordinates.depth *
                               placement.position.endCoordinates.height;
    
            await run(
                'UPDATE containers SET usedVolume = usedVolume + ? WHERE containerId = ?',
                [itemVolume, placement.containerId]
            );
    
            await this.logAction('place', placement.itemId, 'system');
        }
    
        return { placements };
    }
    

    

    async searchItem(itemId) {
        const item = await query('SELECT * FROM items WHERE itemId = ?', [itemId]);
        return item[0] || { error: 'Item not found' };
    }

    async retrieveItem({ itemId, userId, timestamp }) {
        const item = await this.searchItem(itemId);
        if (!item.containerId) throw new Error('Item not stored');
        await run('UPDATE items SET status = ? WHERE itemId = ?', ['retrieved', itemId]);
        await this.logAction('retrieve', itemId, userId, timestamp);
        return { message: `Item ${itemId} retrieved`, item };
    }

    async identifyWaste() {
        const currentDate = new Date().toISOString().split('T')[0];
        const wasteItems = await query(`
            SELECT * FROM items 
            WHERE (expiryDate < ? AND expiryDate != 'N/A') OR usageLimit <= 0
        `, [currentDate]);
        return { wasteItems };
    }

    async planWasteReturn({ undockingContainerId, undockingDate, maxWeight }) {
        const wasteItems = (await this.identifyWaste()).wasteItems;
        let totalWeight = 0;
        const returnItems = [];

        for (const item of wasteItems) {
            const weight = item.width * item.depth * item.height * 0.1; // Arbitrary weight calc
            if (totalWeight + weight <= maxWeight) {
                totalWeight += weight;
                returnItems.push(item.itemId);
                await run('UPDATE items SET status = ?, containerId = ? WHERE itemId = ?', ['waste_planned', undockingContainerId, item.itemId]);
                await this.logAction('waste_plan', item.itemId, 'system');
            }
        }
        return { undockingContainerId, undockingDate, returnItems, totalWeight };
    }

    async simulateDay({ numOfDays, itemsToBeUsedPerDay }) {
        for (let day = 1; day <= numOfDays; day++) {
            for (const item of itemsToBeUsedPerDay) {
                const currentItem = await this.searchItem(item.itemId);
                if (currentItem.usageLimit > 0) {
                    await run('UPDATE items SET usageLimit = usageLimit - 1 WHERE itemId = ?', [item.itemId]);
                    await this.logAction('use', item.itemId, 'system');
                }
            }
        }
        return { message: `Simulated ${numOfDays} days` };
    }

    async getLogs({ startDate, endDate }) {
        const logs = await query('SELECT * FROM logs WHERE timestamp BETWEEN ? AND ?', [startDate, endDate]);
        return { logs };
    }

    async logAction(action, itemId, userId, timestamp = new Date().toISOString()) {
        await run('INSERT INTO logs (action, itemId, userId, timestamp) VALUES (?, ?, ?, ?)', [action, itemId, userId, timestamp]);
    }

    async getItemStats() {
        const result = await query('SELECT COUNT(*) as count FROM items');
        return { totalItems: result[0].count };
    }
    
    async getContainerStats() {
        const containers = await query('SELECT * FROM containers');
        let totalVolume = 0;
        let usedVolume = 0;
        
        containers.forEach(container => {
            const containerVolume = container.width * container.depth * container.height;
            totalVolume += containerVolume;
            usedVolume += Number(container.usedVolume) || 0;
        });
        
        const utilization = totalVolume > 0 ? Math.round((usedVolume / totalVolume) * 100) : 0;
        return { utilization };
    }
    
    async getCriticalItems() {
        const result = await query(`
            SELECT COUNT(*) as count FROM items 
            WHERE usageLimit <= 10 OR 
                  (expiryDate < date('now') AND expiryDate != 'N/A')
        `);
        return { criticalItems: result[0].count };
    }
    
    async getWasteStats() {
        const result = await query(`
            SELECT COUNT(*) as count FROM items 
            WHERE (expiryDate < date('now') AND expiryDate != 'N/A') OR usageLimit <= 0
        `);
        // Assuming each waste item weighs ~1kg for simplicity
        return { wasteKg: result[0].count };
    }
}

module.exports = new CargoService();