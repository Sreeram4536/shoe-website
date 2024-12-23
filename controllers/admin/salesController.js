const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
// const { Table } = require('pdfkit-table');
// const pdf = require('html-pdf')
const {jsPDF} = require('jspdf');
require('jspdf-autotable');

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

            console.log("data is:",salesData);
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
                select: 'productName price'  // Select specific fields you want
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
                    `${item.product ? item.product.productName : 'N/A'} (${item.quantity} x ₹${item.price})`
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
        const { reportType, startDate, endDate } = req.query;
        let dateQuery = { status: 'Delivered' };
        const now = new Date();

        // Determine date range based on report type
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
                model: 'Product',
                select: 'productName price'
            })
            .sort({ createdOn: -1 });

        const summary = await calculateSalesSummary(salesData);

        // Create new PDF document
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add title
        doc.setFontSize(18);
        doc.text('Sales Report', doc.internal.pageSize.width/2, 15, { align: 'center' });
        
        // Add report info
        doc.setFontSize(11);
        doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 14, 25);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);

        // Prepare table data
        const tableData = salesData.map(order => [
            order.orderId,
            new Date(order.createdOn).toLocaleDateString(),
            order.userId ? order.userId.name : 'N/A',
            `${order.totalPrice.toFixed(2)}/-`,
            `${order.discount ? order.discount.toFixed(2) : '0.00'}/-   `,
            `${order.finalAmount.toFixed(2)}/-`,
            order.paymentMethod
        ]);

        // Add table
        doc.autoTable({
            startY: 40,
            head: [[
                'Order ID',
                'Date',
                'Customer',
                'Total Price',
                'Discount',
                'Final Amount',
                'Payment'
            ]],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [51, 51, 51],
                textColor: 255,
                fontSize: 10
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 25 },
                2: { cellWidth: 35 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 },
                6: { cellWidth: 25 }
            }
        });

        // Add summary on new page
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Summary', doc.internal.pageSize.width/2, 15, { align: 'center' });

        // Add summary table
        doc.autoTable({
            startY: 25,
            head: [['Metric', 'Value']],
            body: [
                ['Total Orders', summary.totalOrders.toString()],
                ['Total Sales', `${summary.totalSales.toFixed(2)}/-`],
                ['Total Discount', `${summary.totalDiscount.toFixed(2)}/-`],
                ['Average Order Value', `${summary.averageOrderValue.toFixed(2)}/-`]
            ],
            theme: 'grid',
            headStyles: {
                fillColor: [51, 51, 51],
                textColor: 255
            },
            styles: {
                halign: 'left'
            },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 80 }
            }
        });

        // Convert PDF to buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF',
            error: error.message
        });
    }
};


// const downloadPDF = async (req, res) => {
//     try {
//         const { reportType, startDate, endDate } = req.query;

//         // Determine date range based on report type
//         let dateQuery = {
//             status: 'Delivered'
//         };
//         const now = new Date();

//         switch (reportType) {
//             case 'daily':
//                 dateQuery.createdOn = {
//                     $gte: new Date(now.setHours(0, 0, 0, 0)),
//                     $lte: new Date(now.setHours(23, 59, 59, 999))
//                 };
//                 break;

//             case 'weekly':
//                 const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
//                 dateQuery.createdOn = {
//                     $gte: new Date(startOfWeek.setHours(0, 0, 0, 0)),
//                     $lte: new Date()
//                 };
//                 break;

//             case 'monthly':
//                 const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//                 dateQuery.createdOn = {
//                     $gte: startOfMonth,
//                     $lte: new Date()
//                 };
//                 break;

//             case 'custom':
//                 if (startDate && endDate) {
//                     dateQuery.createdOn = {
//                         $gte: new Date(startDate),
//                         $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
//                     };
//                 }
//                 break;
//         }

//         // Fetch sales data with more robust population
//         const salesData = await Order.find(dateQuery)
//             .populate('userId', 'name email')
//             .populate({
//                 path: 'orderedItems.product',
//                 model: 'Product',
//                 select: 'productName price'
//             })
//             .sort({ createdOn: -1 });

//         // Calculate summary
//         const summary = await calculateSalesSummary(salesData);

//         const doc = new PDFDocument({ margin: 30, size: 'A4' });
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);
//         doc.pipe(res);

//         // Add title
//         doc.fontSize(20).text('Sales Report', { align: 'center' });
//         doc.moveDown();

//         // Create table data
//         const tableData = {
//             headers: ['Order ID', 'Date', 'Customer', 'Products', 'Total', 'Discount', 'Final Amount'],
//             rows: salesData.map(order => [
//                 order.orderId,
//                 new Date(order.createdOn).toLocaleDateString(),
//                 order.userId?.name || 'N/A',
//                 order.orderedItems.map(item => 
//                     `${item.product?.productName || 'N/A'} (x${item.quantity})`
//                 ).join(', '),
//                 `₹${order.totalPrice?.toFixed(2) || '0.00'}`,
//                 `₹${(order.discount || 0).toFixed(2)}`,
//                 `₹${order.finalAmount?.toFixed(2) || '0.00'}`
//             ])
//         };

//         // Draw the table
//         await doc.table(tableData, {
//             prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
//             prepareRow: () => doc.font('Helvetica').fontSize(10),
//             width: 550,
//             padding: 5,
//             divider: {
//                 header: { disabled: false, width: 2, opacity: 1 },
//                 horizontal: { disabled: false, width: 0.5, opacity: 0.5 }
//             }
//         });

//         // Add summary
//         doc.addPage();
//         doc.fontSize(14).text('Summary', { align: 'center' });
//         doc.moveDown();
//         doc.fontSize(12)
//             .text(`Total Orders: ${summary.totalOrders}`)
//             .text(`Total Sales: ₹${summary.totalSales.toFixed(2)}`)
//             .text(`Total Discount: ₹${summary.totalDiscount.toFixed(2)}`)
//             .text(`Average Order Value: ₹${summary.averageOrderValue.toFixed(2)}`);

//         doc.end();
//     } catch (error) {
//         console.error('Error downloading PDF:', error);
//         res.status(500).send('Error generating PDF: ' + error.message);
//     }
// };

// Export individual functions instead of an object
module.exports = { 
    renderSalesReport,
    getSalesReport,
    downloadExcel,
    downloadPDF
}; 