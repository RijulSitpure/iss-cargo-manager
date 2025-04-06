const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('iss_data.db'); // In-memory for simplicity; use a file for persistence

const initializeDatabase = () => {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS items (
                itemId TEXT PRIMARY KEY,
                name TEXT,
                width REAL,
                depth REAL,
                height REAL,
                priority INTEGER,
                expiryDate TEXT,
                usageLimit INTEGER,
                preferredZone TEXT,
                containerId TEXT,
                status TEXT DEFAULT 'stored'
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS containers (
                containerId TEXT PRIMARY KEY,
                zone TEXT,
                width REAL,
                depth REAL,
                height REAL,
                usedVolume REAL DEFAULT 0
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT,
                itemId TEXT,
                userId TEXT,
                timestamp TEXT
            )
        `);
    });
};

const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getItemStats = () => {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as totalItems FROM items', (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getContainerStats = () => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                SUM(width * depth * height) as totalVolume,
                SUM(usedVolume) as usedVolume
            FROM containers
        `, (err, row) => {
            if (err) reject(err);
            else resolve({
                utilization: row.totalVolume ? 
                    Math.round((row.usedVolume / row.totalVolume) * 100) : 0
            });
        });
    });
};

const getCriticalItems = () => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT COUNT(*) as criticalItems FROM items
            WHERE usageLimit <= 10 OR 
                  (expiryDate < date('now') AND expiryDate != 'N/A')
        `, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getWasteStats = () => {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT COUNT(*) as wasteKg FROM items
            WHERE (expiryDate < date('now') AND expiryDate != 'N/A') 
            OR usageLimit <= 0
        `, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

module.exports = { 
    initializeDatabase, 
    query, 
    run,
    getItemStats,
    getContainerStats,
    getCriticalItems,
    getWasteStats
};