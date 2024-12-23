const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema')
const mongoose = require('mongoose');
const Wallet = require('../../models/walletSchema');
const PDFDocument = require('pdfkit');

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

const returnOrder = async (req, res) => {
    try {
        console.log('1. Return order request received');
        const userId = req.session.user;
        const orderId = req.params.orderId;
        const { amount } = req.body;

        console.log('2. Request details:', {
            userId,
            orderId,
            amount,
            body: req.body
        });

        if (!amount || isNaN(parseFloat(amount))) {
            console.log('3. Invalid amount:', amount);
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }

        const order = await Order.findById(orderId);
        console.log('4. Found order:', order);

        if (!order) {
            console.log('5. Order not found for ID:', orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.userId.toString() !== userId) {
            console.log('6. User ID mismatch:', {
                orderUserId: order.userId.toString(),
                requestUserId: userId
            });
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        if (order.status !== 'Delivered') {
            console.log('7. Invalid order status:', order.status);
            return res.status(400).json({
                success: false,
                message: 'Only delivered orders can be returned'
            });
        }

        try {
            // Update order status
            const updatedOrder = await Order.findByIdAndUpdate(
                orderId,
                { status: 'Returned' },
                { new: true }
            );
            console.log('8. Order status updated to Returned');

             // Add this new code for Wallet collection
             const walletTransaction = {
                transactionId: `RET${Date.now()}${orderId.slice(-4)}`, // Unique transaction ID
                amount: parseFloat(amount),
                type: 'Credit',
                description: `Refund for returned order `,
                orderId: orderId,
                status: 'Success',
                createdAt: new Date()
            };

            let wallet = await Wallet.findOne({ userId });
            if (wallet) {
                // Update existing wallet
                wallet.transactions.push(walletTransaction);
                wallet.balance = wallet.balance + parseFloat(amount);
                await wallet.save();
            } else {
                // Create new wallet document
                wallet = new Wallet({
                    userId,
                    balance: parseFloat(amount),
                    transactions: [walletTransaction],
                    isActive: true
                });
                await wallet.save();
            }

            // Update user wallet
            const user = await User.findById(userId);
            if (!user) {
                console.log('9. User not found:', userId);
                throw new Error('User not found');
            }

            const previousWallet = user.wallet || 0;
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { wallet: previousWallet + parseFloat(amount) },
                { new: true }
            );

            console.log('10. Wallet document created/updated:', {
                transactionId: walletTransaction.transactionId,
                amount: amount,
                newBalance: wallet.balance
            });

            return res.status(200).json({
                success: true,
                message: 'Order returned successfully and amount added to wallet'
            });

        } catch (error) {
            console.log('11. Error in updates:', error);
            throw error;
        }
    } catch (error) {
        console.error('12. Final error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while processing the return',
            error: error.message
        });
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate('userId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Get delivery address
        const addressDoc = await Address.findOne(
            { userId: order.userId._id, "address._id": order.address },
            { "address.$": 1 }
        );

        // Create PDF document with larger margins
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4'
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        // Helper function for lines
        function drawLine(doc, startX, startY, endX, endY) {
            doc.moveTo(startX, startY)
               .lineTo(endX, endY)
               .stroke();
        }

        // Store Header
        doc.fontSize(25)
           .font('Helvetica-Bold')
           .fillColor('#487379')
           .text('DOWNY SHOES', { align: 'center' })
           .fontSize(12)
           .fillColor('#666666')
           .text('Premium Footwear Store', { align: 'center' })
           .moveDown();

        drawLine(doc, 50, doc.y, 550, doc.y);
        doc.moveDown();

        // Invoice Title
        doc.fontSize(20)
           .fillColor('#333333')
           .text('INVOICE', { align: 'center' })
           .moveDown();

        // Order & Shipping Details in columns
        const rightColumn = 300;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Order Details:', 50)
           .font('Helvetica')
           .moveDown(0.5)
           .text(`Order ID: #${order.orderId}`)
           .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`)
           .text(`Payment Method: ${order.paymentMethod}`)
           .text(`Payment Status: ${order.paymentStatus}`);

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Ship To:', rightColumn, doc.y - 85)
           .font('Helvetica')
           .text(addressDoc.address[0].name, rightColumn)
           .text(addressDoc.address[0].city, rightColumn)
           .text(addressDoc.address[0].landMark, rightColumn)
           .text(`${addressDoc.address[0].state}, ${addressDoc.address[0].pincode}`, rightColumn)
           .text(`Phone: ${addressDoc.address[0].phone}`, rightColumn)
           .moveDown();

        // Products Table
        drawLine(doc, 50, doc.y, 550, doc.y);
        doc.moveDown();

        // Table headers with background
        const tableTop = doc.y;
        doc.fillColor('#487379')
           .rect(50, tableTop, 500, 25)
           .fill();

        // Table header text
        doc.fillColor('#FFFFFF')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Product', 60, tableTop + 7)
           .text('Quantity', 270, tableTop + 7)
           .text('Price', 370, tableTop + 7)
           .text('Total', 470, tableTop + 7);

        // Reset text color for items
        doc.fillColor('#000000');

        // Table content with alternate row colors
        let yPos = tableTop + 30;
        order.orderedItems.forEach((item, index) => {
            // Alternate row background
            if (index % 2 === 0) {
                doc.fillColor('#f6f6f6')
                   .rect(50, yPos - 5, 500, 25)
                   .fill();
            }

            doc.fillColor('#000000')
               .fontSize(10)
               .font('Helvetica')
               .text(item.product.productName.substring(0, 30), 60, yPos)
               .text(item.quantity.toString(), 270, yPos)
               .text(`${item.price.toFixed(2)}`, 370, yPos)
               .text(`${(item.quantity * item.price).toFixed(2)}`, 470, yPos);

            yPos += 25;
        });

        // Add line after items
        drawLine(doc, 50, yPos + 10, 550, yPos + 10);

        // Totals section
        yPos += 20;
        doc.font('Helvetica')
           .fontSize(10)
           .text('Subtotal:', 370, yPos)
           .text(`Rs.${order.totalPrice.toFixed(2)}`, 470, yPos);

        yPos += 20;
        doc.text('Discount:', 370, yPos)
           .text(`${order.discount.toFixed(2)}`, 470, yPos);

        yPos += 25;
        doc.font('Helvetica-Bold')
           .fontSize(12)
           .text('Final Amount:', 370, yPos)
           .text(`Rs.${order.finalAmount.toFixed(2)}`, 470, yPos);

        // Footer (positioned at bottom)
        const footerTop = doc.page.height - 50;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666');

        // Footer border
        drawLine(doc, 50, footerTop - 10, 550, footerTop - 10);

        // Footer content centered
        doc.text('Thank you for shopping with Downy Shoes!', {
            align: 'center',
            width: 500,
            continued: true
        })
        .moveDown(0.5)
        .text('For any queries, please contact: support@downyshoes.com', {
            align: 'center',
            width: 500
        })
        .moveDown(0.5)
        .text('Visit us at: www.downyshoes.com', {
            align: 'center',
            width: 500
        });

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
    }
};

// const placeOrder = async (req, res) => {
//     try {
//         const { paymentMethod, chosenAddress } = req.body;
        
//         // Create the order
//         const order = new Order({
//             // ... your order creation logic ...
//             paymentMethod,
//             paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending',
//             status: 'Pending'
//         });

//         await order.save();

//         res.send(`
//             <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
//             <script>
//                 Swal.fire({
//                     icon: 'success',
//                     title: 'Order placed successfully!',
//                     showConfirmButton: false,
//                     timer: 1500
//                 }).then(() => {
//                     window.location.href = '/user/orders';
//                 });
//             </script>
//         `);
//     } catch (error) {
//         console.error('Error placing order:', error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

module.exports = { viewOrderDetails,cancelOrder,allOrdersPage,returnOrder,downloadInvoice};