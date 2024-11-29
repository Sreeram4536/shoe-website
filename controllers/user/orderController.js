const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema')

const viewOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.orderId;
        
        const order = await Order.findOne({ _id: orderId })
            .populate('orderedItems.product');

        if (!order) {
            return res.render('user/order-indetail', { 
                order: null, 
                session: req.session,
                errorMessage: 'Order not found'
            });
        }

        const userAddresses = await Address.findOne({ userId });
        const orderObj = order.toObject();
        
        if (userAddresses && userAddresses.address) {
            orderObj.deliveryAddress = userAddresses.address.find(
                addr => addr._id.toString() === order.address.toString()
            );
        }

        res.render('user/order-indetail', { 
            order: orderObj, 
            session: req.session,
            errorMessage: null
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.render('user/order-indetail', { 
            order: null, 
            session: req.session,
            errorMessage: 'Error loading order details'
        });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.orderId;
        
        const order = await Order.findOne({ _id: orderId })
            .populate('orderedItems.product');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found or unauthorized access'
            });
        }

        if (order.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled as it is not in "Pending" status'
            });
        }

        order.status = 'Cancelled';
        await order.save();

        // Update product quantities
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Order cancelled successfully'
        });
        
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while cancelling the order'
        });
    }
};

const allOrdersPage = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Query orders based on the logged-in user and sort by invoiceDate in descending order
        const orders = await Order.find({ userId })
            .populate('orderedItems.product')
            .sort({ invoiceDate: -1 });

        // Set default message for no orders
        const message = orders.length === 0 ? 'No orders found.' : '';

        res.render('user/order-details', {
            orders: orders,
            message: message,
            session: req.session,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

module.exports = { viewOrderDetails,cancelOrder,allOrdersPage};
