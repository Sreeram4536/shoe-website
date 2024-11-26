const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

const viewOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;  // Authenticated user ID
        const orderId = req.params.orderId;  // Order ID from URL params
        console.log("orderid is",orderId);
        console.log("userid is:",userId);
        
        
        // Fetch the order details, including the address and ordered items
        const order = await Order.findOne({_id: orderId })
            .populate('orderedItems.product')
            .populate('address');
        
        if (!order ) {
            return res.status(404).send('Order not found or unauthorized access.');
        }

        res.render('user/order-indetail', { order, session: req.session });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Internal Server Error');
    }
};

const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.user;  // Authenticated user ID
        const orderId = req.params.orderId;  // Order ID from URL params
        console.log("order id in removal:",orderId);
        

        // Fetch the order details to check if the order is in 'Pending' status
        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
        
        if (!order ) {
            return res.status(404).send('Order not found or unauthorized access.');
        }

        if (order.status !== 'Pending') {
            return res.status(400).send('Order cannot be cancelled as it is not in "Pending" status.');
        }

        // Cancel the order and update product quantities
        order.status = 'Cancelled';
        await order.save();

        // Update the product quantities in stock
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity }
            });
        }

        // Redirect back to order details page with the updated status
        // res.redirect(`/user/order/${orderId}`);

         // Render the order-indetail page with updated order details
         res.render('user/order-details', { order, session: req.session });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).send('Internal Server Error');
    }
};

const allOrdersPage = async (req, res) => {
    try {
        // const userId = req.session.user._id;  // Get the logged-in user's ID from session
        const userId = req.session.user;
        const orderId = req.session.orderId;
        
        // Query orders based on the logged-in user
        const orders = await Order.find({ userId }).populate('orderedItems.product');  // Populate product details

        if (orders.length === 0) {
            return res.render('user/order-details', { message: 'No orders found.',orders:[] });
        }

        res.render('user/order-details', { orders,session:req.session });  // Render the order-list.ejs page with the orders data
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

module.exports = { viewOrderDetails,cancelOrder,allOrdersPage};
