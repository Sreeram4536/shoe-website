const User=require('../../models/userSchema');
const mongoose=require('mongoose');
STATUS_CODES = require('../../constants/statusCodes');

const customerInfo = async (req, res) => {
    try {
        // Retrieve search query if provided
        let search = req.query.search || "";

        // Set up pagination variables
        let page = parseInt(req.query.page) || 1;
        const limit = 3; // Number of records per page

        // Fetch data with search filter and pagination
        const data = await User.find({
            isAdmin: false, // Only non-admin users
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ]
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        // Count total documents for pagination
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: 'i' } },
                { email: { $regex: ".*" + search + ".*", $options: 'i' } }
            ]
        });

        // Calculate total pages
        const totalPages = Math.ceil(count / limit);

        // Render the template with data, pagination details, and search term
        res.render('admin/customers', { data, totalPages, currentPage: page, search });
        
    } catch (error) {
        console.error("Error fetching customer data:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Error loading customer data.");
    }
}

const customerBlocked= async(req,res)=>{
    try {
        let id=req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/users")
        
    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

const customerunBlocked=async(req,res)=>{
    try {
        let id =req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect("/pageerror")
    }
}


module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked
}