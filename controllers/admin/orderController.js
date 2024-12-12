const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');


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
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        const order = await Order.findById(orderId)
            .populate('orderedItems.product');
            
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const previousStatus = order.status;
        order.status = status;

        // Handle inventory updates
        if (status === 'Cancelled' && previousStatus !== 'Cancelled') {
            // Increase product quantities when order is cancelled
            for (const item of order.orderedItems) {
                await Product.findByIdAndUpdate(item.product._id, {
                    $inc: { quantity: item.quantity }
                });
            }
        } else if (previousStatus === 'Cancelled' && status === 'Pending') {
            // Decrease product quantities when order is moved back to pending
            for (const item of order.orderedItems) {
                const product = await Product.findById(item.product._id);
                if (product.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${product.productName}`
                    });
                }
                await Product.findByIdAndUpdate(item.product._id, {
                    $inc: { quantity: -item.quantity }
                });
            }
        }

        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Error changing order status:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
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
// const updateProductQuantity = async (req, res) => {
//     try {
//         const { productId } = req.params;
//         const { quantity } = req.body;

//         if (quantity < 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Quantity cannot be negative'
//             });
//         }

//         const product = await Product.findById(productId);
//         if (!product) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Product not found'
//             });
//         }

//         product.quantity = quantity;
//         product.status = quantity > 0 ? 'Available' : 'Out of Stock';
//         await product.save();

//         res.status(200).json({
//             success: true,
//             message: 'Quantity updated successfully',
//             newStatus: product.status
//         });
//     } catch (error) {
//         console.error('Error updating product quantity:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal Server Error'
//         });
//     }
// };

const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate('userId', 'name email')
            .populate('orderedItems.product')
            .populate('address');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Render a partial view with order details
        res.render('admin/orderDetails', { order });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).send('Server Error');
    }
};

const orderDetailPage = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate('userId', 'name email')
            .populate('orderedItems.product');

        if (!order) {
            return res.redirect('/admin/orderList');
        }

        const orderObj = order.toObject();

        // Find the delivery address
        const addressDoc = await Address.findOne(
            { 
                userId: order.userId._id,
                "address._id": order.address  // Look for the specific address ID within the address array
            },
            {
                "address.$": 1  // Project only the matched address from the array
            }
        );

        if (addressDoc && addressDoc.address && addressDoc.address[0]) {
            orderObj.deliveryAddress = {
                addressType: addressDoc.address[0].addressType,
                name: addressDoc.address[0].name,
                city: addressDoc.address[0].city,
                landMark: addressDoc.address[0].landMark,
                state: addressDoc.address[0].state,
                pincode: addressDoc.address[0].pincode,
                phone: addressDoc.address[0].phone,
                altPhone: addressDoc.address[0].altPhone
            };
        }

        res.render('admin/orderDetail', { 
            order: orderObj,
            title: 'Order Details'
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.redirect('/admin/orderList');
    }
};


module.exports = { listOrders, changeOrderStatus, cancelOrder, manageInventory,getOrderDetails,orderDetailPage };