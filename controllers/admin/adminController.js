const User = require("../../models/userSchema")
const mongoose=require('mongoose');
const bcrypt = require("bcrypt");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");

const pageerror = async(req,res)=>{
    res.render('admin/admin-error')
}

const loadLogin = (req,res)=>{
    // console.log("Session admin data:", req.session.admin);
    if(req.session.admin){
        return res.redirect("/admin/dashboard")
    }
    res.render("admin/admin-login",{message:null})
}

const login = async(req,res)=>{
    try {
        const{email,password}=req.body;
        const admin= await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch){
                // req.session.admin=true;
                req.session.admin = admin._id; // Store the ObjectId, not a boolean
                // console.log("Session admin set to:", req.session.admin);
                return res.redirect("/admin")
            }else{
              return res.redirect('/admin/login')  
            }
        }else{
            return res.redirect("/admin/login")
        }

    } catch (error) {

        console.log("Login error",error);
        return res.redirect("/admin/pageerror")
        
        
    }
};

const loadDashboard = async (req, res) => {
    if (req.session.admin) {
        try {
            // Fetch today's sales
            const todaySales = await getTodaySales();
            // Fetch monthly sales
            const monthlySales = await getMonthlySales();
            // Fetch top selling products
            const topSellingProducts = await Product.find()
                .sort({ salesCount: -1 })
                .limit(10)
                .select('productName salesCount');

            // Fetch top selling categories
            const topSellingCategories = await Category.find()
                .sort({ totalSales: -1 })
                .limit(10)
                .select('name totalSales');

            // Fetch top selling brands
            const topSellingBrands = await Brand.find()
                .sort({ salesCount: -1 })
                .limit(10)
                .select('brandName salesCount');

            res.render('admin/dashboard', {
                todaySales,
                monthlySales,
                topSellingProducts,
                topSellingCategories,
                topSellingBrands
            });
        } catch (error) {
            console.error('Error loading dashboard:', error);
            res.redirect('/admin/pageerror');
        }
    } else {
        res.redirect('/admin/login');
    }
};

const getTodaySales = async () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000); // End of today

    const todaySales = await Order.aggregate([
        {
            $match: {
                invoiceDate: {
                    $gte: startOfToday,
                    $lt: endOfToday
                }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: "$finalAmount" }
            }
        }
    ]);

    return todaySales.length > 0 ? todaySales[0].totalSales : 0;
};

const getMonthlySales = async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1); // Start of next month

    const monthlySales = await Order.aggregate([
        {
            $match: {
                invoiceDate: {
                    $gte: startOfMonth,
                    $lt: endOfMonth
                }
            }
        },
        {
            $group: {
                _id: null,
                totalSales: { $sum: "$finalAmount" }
            }
        }
    ]);

    return monthlySales.length > 0 ? monthlySales[0].totalSales : 0;
};

// const getSalesData = async (req, res) => {
//     const { filter, startDate, endDate } = req.query;
//     let matchStage = {};
    
//     // Define the match stage based on the filter
//     if (filter === 'daily') {
//         matchStage = {
//             $match: {
//                 invoiceDate: {
//                     $gte: new Date(new Date().setHours(0, 0, 0, 0)), // Start of today
//                     $lt: new Date(new Date().setHours(23, 59, 59, 999)) // End of today
//                 }
//             }
//         };
//     } else if (filter === 'monthly') {
//         matchStage = {
//             $match: {
//                 invoiceDate: {
//                     $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of the month
//                     $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) // Start of next month
//                 }
//             }
//         };
//     } else if (startDate && endDate) {
//         matchStage = {
//             $match: {
//                 invoiceDate: {
//                     $gte: new Date(startDate),
//                     $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // End of the selected date
//                 }
//             }
//         };
//     }

//     try {
//         const salesData = await Order.aggregate([
//             matchStage,
//             {
//                 $group: {
//                     _id: {
//                         year: { $year: "$invoiceDate" },
//                         month: { $month: "$invoiceDate" },
//                         day: { $dayOfMonth: "$invoiceDate" }
//                     },
//                     totalSales: { $sum: "$finalAmount" }
//                 }
//             },
//             { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
//         ]);

//         res.json({ success: true, data: salesData });
//     } catch (error) {
//         console.error('Error fetching sales data:', error);
//         res.json({ success: false, error: 'Error fetching sales data' });
//     }
// };

const getSalesData = async (req, res) => {
    const { filter, startDate, endDate } = req.query;
    let matchStage = {};
    let groupStage = {};
    let sortStage = {};

    const today = new Date();

    if (filter === 'daily') {
        // Last 5 Days
        const startOfFiveDaysAgo = new Date(today);
        startOfFiveDaysAgo.setDate(today.getDate() - 4); // Go back 4 days

        matchStage = {
            $match: {
                invoiceDate: {
                    $gte: new Date(startOfFiveDaysAgo.setHours(0, 0, 0, 0)),
                    $lt: new Date(today.setHours(23, 59, 59, 999))
                }
            }
        };

        groupStage = {
            $group: {
                _id: {
                    year: { $year: "$invoiceDate" },
                    month: { $month: "$invoiceDate" },
                    day: { $dayOfMonth: "$invoiceDate" }
                },
                totalSales: { $sum: "$finalAmount" }
            }
        };

        sortStage = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };

    } else if (filter === 'weekly') {
        // Group by week
        matchStage = {
            $match: {
                invoiceDate: {
                    $gte: new Date(today.getFullYear(), 0, 1), // Start of the year
                    $lt: new Date(today.getFullYear() + 1, 0, 1) // Start of next year
                }
            }
        };

        groupStage = {
            $group: {
                _id: {
                    year: { $year: "$invoiceDate" },
                    week: { $week: "$invoiceDate" } // Week number
                },
                totalSales: { $sum: "$finalAmount" }
            }
        };

        sortStage = { "_id.year": 1, "_id.week": 1 };

    } else if (filter === 'monthly') {
        // Group by month
        matchStage = {
            $match: {
                invoiceDate: {
                    $gte: new Date(today.getFullYear(), 0, 1), // Start of the year
                    $lt: new Date(today.getFullYear() + 1, 0, 1) // Start of next year
                }
            }
        };

        groupStage = {
            $group: {
                _id: {
                    year: { $year: "$invoiceDate" },
                    month: { $month: "$invoiceDate" }
                },
                totalSales: { $sum: "$finalAmount" }
            }
        };

        sortStage = { "_id.year": 1, "_id.month": 1 };

    } else if (filter === 'yearly') {
        // Group by year
        matchStage = {
            $match: {
                invoiceDate: { $exists: true }
            }
        };

        groupStage = {
            $group: {
                _id: { year: { $year: "$invoiceDate" } },
                totalSales: { $sum: "$finalAmount" }
            }
        };

        sortStage = { "_id.year": 1 };

    } else if (startDate && endDate) {
        // Custom date range
        matchStage = {
            $match: {
                invoiceDate: {
                    $gte: new Date(startDate),
                    $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999))
                }
            }
        };

        groupStage = {
            $group: {
                _id: {
                    year: { $year: "$invoiceDate" },
                    month: { $month: "$invoiceDate" },
                    day: { $dayOfMonth: "$invoiceDate" }
                },
                totalSales: { $sum: "$finalAmount" }
            }
        };

        sortStage = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
    }

    try {
        const salesData = await Order.aggregate([
            matchStage,
            groupStage,
            { $sort: sortStage }
        ]);

        res.json({ success: true, data: salesData });
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.json({ success: false, error: 'Error fetching sales data' });
    }
};


const getTopSellingProducts = async (req, res) => {
    const topProducts = await Product.find()
        .sort({ salesCount: -1 })
        .limit(10)
        .select('productName salesCount');
    res.json(topProducts);
};

const getTopSellingCategories = async (req, res) => {
    const topCategories = await Category.find()
        .sort({ totalSales: -1 })
        .limit(10)
        .select('name totalSales');
    res.json(topCategories);
};

const getTopSellingBrands = async (req, res) => {
    const topBrands = await Brand.find()
        .sort({ salesCount: -1 })
        .limit(10)
        .select('brandName salesCount');
    res.json(topBrands);
};

const logout = async(req,res)=>{
    try {

        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect('/pageerror')
            }
            res.redirect('/admin/login')
        })
        
    } catch (error) {

        console.log("unexpected error during logout",error);
        res.redirect('/pageerror')
        
        
    }
}



module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getSalesData,
    getTopSellingProducts,
    getTopSellingCategories,
    getTopSellingBrands
}