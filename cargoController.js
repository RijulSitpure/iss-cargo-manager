const express = require('express');
const multer = require('multer'); // Add multer here
const router = express.Router();
const cargoService = require('./cargoService');
const { 
    getItemStats,
    getContainerStats, 
    getCriticalItems,
    getWasteStats
} = require('./database');

const upload = multer({ storage: multer.memoryStorage() }); // Define multer here

class CargoController {
    async importItems(req, res) {
        try {
            const data = await cargoService.importItems(req.file);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async importContainers(req, res) {
        try {
            const data = await cargoService.importContainers(req.file);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async placeItems(req, res) {
        try {
            const data = await cargoService.placeItems(req.body);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async searchItem(req, res) {
        try {
            const data = await cargoService.searchItem(req.query.itemId);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async retrieveItem(req, res) {
        try {
            const data = await cargoService.retrieveItem(req.body);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async identifyWaste(req, res) {
        try {
            const data = await cargoService.identifyWaste();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async planWasteReturn(req, res) {
        try {
            const data = await cargoService.planWasteReturn(req.body);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async simulateDay(req, res) {
        try {
            const data = await cargoService.simulateDay(req.body);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getLogs(req, res) {
        try {
            const data = await cargoService.getLogs(req.query);
            res.json(data);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async getItemStats(req, res) {
        try {
            const stats = await getItemStats();
            res.json(stats);
        } catch (error) {
            console.error('Items stats error:', error);
            res.status(500).json({ error: 'Failed to get item statistics' });
        }
    }

    async getContainerStats(req, res) {
        try {
            const stats = await getContainerStats();
            res.json(stats);
        } catch (error) {
            console.error('Container stats error:', error);
            res.status(500).json({ error: 'Failed to get container statistics' });
        }
    }

    async getCriticalItems(req, res) {
        try {
            const stats = await getCriticalItems();
            res.json(stats);
        } catch (error) {
            console.error('Critical items error:', error);
            res.status(500).json({ error: 'Failed to get critical items' });
        }
    }

    async getWasteStats(req, res) {
        try {
            const stats = await getWasteStats();
            res.json(stats);
        } catch (error) {
            console.error('Waste stats error:', error);
            res.status(500).json({ error: 'Failed to get waste statistics' });
        }
    }
}


const controller = new CargoController();

// Define routes with multer for file uploads
router.post('/import/items', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Process the file...
        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/import/items', upload.single('file'), controller.importItems.bind(controller));
router.post('/import/containers', upload.single('file'), controller.importContainers.bind(controller));
router.post('/placement', controller.placeItems.bind(controller));
router.get('/search', controller.searchItem.bind(controller));
router.post('/retrieve', controller.retrieveItem.bind(controller));
router.get('/waste/identify', controller.identifyWaste.bind(controller));
router.post('/waste/return-plan', controller.planWasteReturn.bind(controller));
router.post('/simulate/day', controller.simulateDay.bind(controller));
router.get('/logs', controller.getLogs.bind(controller));
// Inside cargoController.js (add these lines with your other routes)
router.get('/stats/items', controller.getItemStats.bind(controller));
router.get('/stats/containers', controller.getContainerStats.bind(controller));
router.get('/stats/critical', controller.getCriticalItems.bind(controller));
router.get('/stats/waste', controller.getWasteStats.bind(controller));

router.post('/place', async (req, res) => {
    try {
        const item = req.body;
        const result = await cargoService.addItemToStorage(item);
        res.json(result);
    } catch (error) {
        console.error('Error placing item:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;