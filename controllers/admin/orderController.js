const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');


const listOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId', 'name email')
            .populate('orderedItems.product', 'productName salePrice')
            .populate('address');
        res.render('admin/orderList', { orders });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server Error');
    }
};


const changeOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
        if (!validStatuses.includes(status)) {
            return res.status(400).send('Invalid status');
        }

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).send('Order not found');
        }

        order.status = status;
        await order.save();

        res.redirect('/admin/orderList');
    } catch (error) {
        console.error('Error changing order status:', error);
        res.status(500).send('Server Error');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId });
        if (!order || order.status !== 'Pending') {
            return res.status(400).send('Order cannot be cancelled');
        }

        order.status = 'Cancelled';
        await order.save();

        // Restore stock quantities
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { quantity: item.quantity }
            });
        }

        res.redirect('/admin/orderList');
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).send('Server Error');
    }
};


const manageInventory = async (req, res) => {
    try {
        const products = await Product.find().select('productName quantity status salePrice');
        res.render('admin/inventory', { products });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).send('Server Error');
    }
};

// Update product quantity
const updateProductQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;

        if (quantity < 0) {
            return res.status(400).send('Quantity cannot be negative.');
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found.');
        }

        product.quantity = quantity;
        product.status = quantity > 0 ? 'Available' : 'Out of Stock';
        await product.save();

        res.redirect('/admin/inventory');
    } catch (error) {
        console.error('Error updating product quantity:', error);
        res.status(500).send('Internal Server Error');
    }
};


module.exports = { listOrders, changeOrderStatus, cancelOrder, manageInventory,updateProductQuantity };
