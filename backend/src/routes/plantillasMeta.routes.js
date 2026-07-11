const express = require('express');
const router = express.Router();
const controller = require('../controllers/plantillaMeta.controller');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.use(requireAdmin);

router.get('/', controller.getAll);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
