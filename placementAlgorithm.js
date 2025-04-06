const placeItems = (items, containers) => {
    const placements = [];
    const containerMap = new Map(containers.map(c => [c.containerId, { ...c, items: [], usedVolume: 0 }]));

    for (const item of items.sort((a, b) => b.priority - a.priority)) {
        let placed = false;
        const preferredZone = item.preferredZone?.trim();

        for (const [containerId, container] of containerMap) {
            const containerZone = container.zone?.trim();

            if (!preferredZone || preferredZone === containerZone) {
                const itemVolume = item.width * item.depth * item.height;
                const containerVolume = container.width * container.depth * container.height;

                const usedVolume = typeof container.usedVolume === 'number'
                    ? container.usedVolume
                    : parseFloat(container.usedVolume) || 0;

                if (usedVolume + itemVolume <= containerVolume) {
                    container.usedVolume = usedVolume + itemVolume;
                    container.items.push(item.itemId);
                    placements.push({
                        itemId: item.itemId,
                        containerId,
                        position: {
                            startCoordinates: { width: 0, depth: 0, height: 0 },
                            endCoordinates: { width: item.width, depth: item.depth, height: item.height }
                        }
                    });
                    placed = true;
                    break;
                }
            }
        }

        if (!placed) {
            console.error(`Item ${item.itemId} not placed. PreferredZone="${preferredZone}"`);
            throw new Error(`No space for item ${item.itemId}`);
        }
    }

    return { placements, updatedContainers: Array.from(containerMap.values()) };
};

module.exports = { placeItems };
