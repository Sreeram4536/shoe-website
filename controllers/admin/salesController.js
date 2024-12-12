const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Add the missing calculateSalesSummary function
const calculateSalesSummary = async (salesData) => {
    return {
        totalOrders: salesData.length,
        totalSales: salesData.reduce((sum, order) => sum + order.finalAmount, 0),
        totalDiscount: salesData.reduce((sum, order) => sum + (order.discount || 0), 0),
        averageOrderValue: salesData.length > 0 
            ? salesData.reduce((sum, order) => sum + order.finalAmount, 0) / salesData.length 
            : 0
    };
};

// Remove the salesController object and directly export individual functions
const renderSalesReport = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Get initial daily sales data
        const salesData = await Order.find({
            createdOn: { $gte: startOfDay, $lte: endOfDay },
            status: { $nin: ['Cancelled'] }
        })
        .populate('userId', 'name email')
        .populate('orderedItems.product');

        // Calculate summary statistics
        const summary = await calculateSalesSummary(salesData);

        res.render('admin/salesReport', {
            sales: salesData,
            summary,
            reportType: 'daily'
        });
    } catch (error) {
        console.error('Error rendering sales report:', error);
        res.status(500).send('Error loading sales report');
    }
};



const getSalesReport = async (req, res) => {
    console.log('Full Request Body:', req.body);
    console.log('Report Type:', req.body.reportType);

    try {
        const { reportType, startDate, endDate } = req.body;

        // Validate report type
        if (!reportType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Report type is required' 
            });
        }

        // Determine date range based on report type
        let dateQuery = {
            // Only include delivered orders
            status: 'Delivered'
        };
        const now = new Date();

        switch (reportType) {
            case 'daily':
                dateQuery.createdOn = { 
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                };
                break;

            case 'weekly':
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateQuery.createdOn = { 
                    $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
                    $lte: new Date()
                };
                break;

            case 'monthly':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateQuery.createdOn = { 
                    $gte: startOfMonth,
                    $lte: new Date()
                };
                break;

            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Start and end dates are required for custom report' 
                    });
                }
                dateQuery.createdOn = {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                };
                break;

            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid report type' 
                });
        }

        // Fetch sales data
        const salesData = await Order.find(dateQuery)
            .populate('userId', 'name email')
            .populate('orderedItems.product')
            .sort({ createdOn: -1 });

        // Calculate summary
        const summary = await calculateSalesSummary(salesData);

        // Return response
        res.json({ 
            success: true, 
            sales: salesData, 
            summary 
        });

    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error generating sales report',
            error: error.message 
        });
    }
};

const downloadExcel = async (req, res) => {
    try {
        console.log('Excel Download Query:', req.query);

        const { reportType, startDate, endDate } = req.query;

        // Determine date range based on report type
        let dateQuery = {
            status: 'Delivered'
        };
        const now = new Date();

        switch (reportType) {
            case 'daily':
                dateQuery.createdOn = { 
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                };
                break;
            case 'weekly':
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateQuery.createdOn = { 
                    $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
                    $lte: new Date()
                };
                break;
            case 'monthly':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateQuery.createdOn = { 
                    $gte: startOfMonth,
                    $lte: new Date()
                };
                break;
            case 'custom':
                if (startDate && endDate) {
                    dateQuery.createdOn = {
                        $gte: new Date(startDate),
                        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    };
                }
                break;
        }

        // Fetch sales data with more robust population
        const salesData = await Order.find(dateQuery)
            .populate('userId', 'name email')
            .populate({
                path: 'orderedItems.product',
                model: 'Product',  // Explicitly specify the model name
                select: 'name price'  // Select specific fields you want
            })
            .sort({ createdOn: -1 });

        // Calculate summary
        const summary = await calculateSalesSummary(salesData);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add headers
        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Customer', key: 'customerName', width: 25 },
            { header: 'Products', key: 'products', width: 50 },
            { header: 'Total Price', key: 'totalPrice', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 15 }
        ];

        // Add data rows
        salesData.forEach(order => {
            worksheet.addRow({
                orderId: order.orderId,
                date: new Date(order.createdOn).toLocaleDateString(),
                customerName: order.userId ? order.userId.name : 'N/A',
                products: order.orderedItems.map(item =>
                    `${item.product ? item.product.name : 'N/A'} (${item.quantity} x ₹${item.price})`
                ).join(', '),
                totalPrice: order.totalPrice,
                discount: order.discount || 0,
                finalAmount: order.finalAmount,
                paymentMethod: order.paymentMethod
            });
        });

        // Add summary rows
        worksheet.addRow({});
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders', summary.totalOrders]);
        worksheet.addRow(['Total Sales', `₹${summary.totalSales.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `₹${summary.totalDiscount.toFixed(2)}`]);

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Excel Download Error:', error);
        res.status(500).send('Error generating Excel: ' + error.message);
    }
};

const downloadPDF = async (req, res) => {
    try {
        console.log('PDF Download Query:', req.query);

        const { reportType, startDate, endDate } = req.query;

        // Determine date range based on report type
        let dateQuery = {
            status: 'Delivered'
        };
        const now = new Date();

        switch (reportType) {
            case 'daily':
                dateQuery.createdOn = { 
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                };
                break;
            case 'weekly':
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateQuery.createdOn = { 
                    $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
                    $lte: new Date()
                };
                break;
            case 'monthly':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateQuery.createdOn = { 
                    $gte: startOfMonth,
                    $lte: new Date()
                };
                break;
            case 'custom':
                if (startDate && endDate) {
                    dateQuery.createdOn = {
                        $gte: new Date(startDate),
                        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                    };
                }
                break;
        }

        // Fetch sales data with more robust population
        const salesData = await Order.find(dateQuery)
            .populate('userId', 'name email')
            .populate({
                path: 'orderedItems.product',
                model: 'Product',  // Explicitly specify the model name
                select: 'productName price'  // Select specific fields you want
            })
            .sort({ createdOn: -1 });

        // Add more detailed logging to diagnose population
        console.log("Sales Data Length:", salesData.length);
        salesData.forEach((order, index) => {
            console.log(`Order ${index} Ordered Items:`, order.orderedItems.map(item => ({
                productId: item.product ? item.product._id : 'No Product',
                productName: item.product ? item.product.productName : 'Undefined',
                quantity: item.quantity,
                price: item.price
            })));
        });

        // Calculate summary
        const summary = await calculateSalesSummary(salesData);

        // Use a Unicode-compatible font
        const doc = new PDFDocument({
            fonts: ['Helvetica', 'Times-Roman'], // Add more font options
            autoFirstPage: true
        });

        // Optional: Register a font that supports Unicode
        // doc.registerFont('DejaVu', 'path/to/DejaVuSans.ttf');
       
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);

        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica').text('Sales Report', { align: 'center' });
        doc.moveDown();

        // Sales Data
        salesData.forEach(order => {
            doc.fontSize(12).font('Helvetica')
                .text(`Order ID: ${order.orderId}`)
                .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`)
                .text(`Customer: ${order.userId ? order.userId.name : 'N/A'}`);
            
            // Products with Unicode Rupee symbol
            doc.text('Products:');
            order.orderedItems.forEach(item => {
                const productName = item.product && item.product.productName 
                    ? item.product.productName 
                    : 'Product Not Found';
                const productPrice = item.product && item.product.salePrice 
                    ? item.product.salePrice 
                    : item.price || 0;
                const quantity = item.quantity || 1;
                
                // Use Unicode Rupee symbol directly
                doc.text(`- ${productName} (${quantity} x ${Number(productPrice).toFixed(2)}/-)`);
            });
            
            // Use Unicode Rupee symbol for prices
            doc.text(`Total Price: ${Number(order.totalPrice).toFixed(2)}/-`)
               .text(`Discount: ${Number(order.discount || 0).toFixed(2)}/-`)
               .text(`Final Amount: ${Number(order.finalAmount).toFixed(2)}/-`)
               .text(`Payment Method: ${order.paymentMethod}`);
            
            doc.moveDown();
        });

        // Summary
        doc.fontSize(14).text('Summary', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12)
            .text(`Total Orders: ${summary.totalOrders}`)
            .text(`Total Sales: ${Number(summary.totalSales).toFixed(2)}/-`)
            .text(`Total Discount: ${Number(summary.totalDiscount).toFixed(2)}/-`);

        doc.end();

    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).send('Error generating PDF: ' + error.message);
    }
};



// Export individual functions instead of an object
module.exports = { 
    renderSalesReport,
    getSalesReport,
    downloadExcel,
    downloadPDF
}; 