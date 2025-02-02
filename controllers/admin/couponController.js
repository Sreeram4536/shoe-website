const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");
const STATUS_CODES = require('../../constants/statusCodes');

const loadCoupon = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const coupons = await Coupon.find().skip(skip).limit(limit);
        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        res.render("admin/coupon", {
            coupons,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};

const createCoupon = async(req,res)=>{
    try {
        const data ={
            couponName :req.body.couponName,
            startDate :new Date(req.body.startDate + "T00:00:00"),
            endDate :new Date(req.body.endDate + "T00:00:00"),
            offerPrice:parseInt(req.body.offerPrice),
            minimumPrice:parseInt(req.body.minimumPrice)
        }

        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expiredOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        });
        await newCoupon.save();
        return res.redirect("/admin/coupon");
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};

const editCoupon = async(req,res)=>{
    try {
        const id = req.query.id;
        const findCoupon = await Coupon.findOne({_id:id});
        

        res.render("admin/editCoupon",{findCoupon:findCoupon})
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const updateCoupon = async(req,res)=>{
    try {
        const couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id:oid});
        
        if(selectedCoupon) {
            const startDate = new Date(req.body.startDate + "T00:00:00Z");
            const endDate = new Date(req.body.endDate + "T00:00:00Z");
            
            const updatedCoupon = await Coupon.updateOne({_id:oid},
                {$set:{
                    name:req.body.couponName,
                    createdOn:startDate,
                    expiredOn:endDate,
                    offerPrice:parseInt(req.body.offerPrice),
                    minimumPrice:parseInt(req.body.minimumPrice)
                }
            },{new:true});
            
            if(updatedCoupon != null) {
                res.send("Coupon updated successfully");
            } else {
                res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send("Coupon update failed");
            }
        }
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.redirect("/pageNotFound");
    }
};

const deleteCoupon = async(req,res)=>{
    try {
        const id = req.query.id;
        const result = await Coupon.deleteOne({_id:id});
        
        if (result.deletedCount > 0) {
            return res.status(STATUS_CODES.OK).json({
                success: true,
                message: "Coupon deleted successfully"
            });
        } else {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: "Coupon not found"
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to delete coupon"
        });
    }
}


module.exports={
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon
}
