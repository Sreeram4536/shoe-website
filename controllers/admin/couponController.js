const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");

const loadCoupon = async(req,res)=>{
    try {
        const findCoupons = await Coupon.find({})
        return res.render("admin/coupon",{coupons:findCoupons})
    } catch (error) {
        return res.redirect("/pageNotFound")
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
        const couponId =req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        const selectedCoupon = await Coupon.findOne({_id:oid});
        if(selectedCoupon){
            const startDate = new Date(req.body.startDate + "T00:00:00");
            const endDate = new Date(req.body.endDate + "T00:00:00");
            const updatedCoupon = await Coupon.updateOne({_id:oid},
                {$set:{
                    name:req.body.couponName,
                    createdOn:startDate,
                    expiredOn:endDate,
                    offerPrice:parseInt(req.body.offerPrice),
                    minimumPrice:parseInt(req.body.minimumPrice)
                }
            },{new:true}
        );
        if(updatedCoupon != null){
            res.send("Coupon updated successfully");
        }else{
            res.status(500).send("Coupon update failed");
        }
            
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const deleteCoupon = async(req,res)=>{
    try {
        const id = req.query.id;
        const result = await Coupon.deleteOne({_id:id});
        
        if (result.deletedCount > 0) {
            return res.status(200).json({
                success: true,
                message: "Coupon deleted successfully"
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
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
