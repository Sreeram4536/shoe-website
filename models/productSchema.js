const mongoose=require('mongoose');
const {Schema}= mongoose;

const productSchema = new mongoose.Schema({
    productName:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true,
    },
    brand:{
        type:String,
        required:false,
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        require:true,
        default:1
    },
    color:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Available","Out of Stock"],
        required:true,
        default:"Available"
    },
    // maxQtyPerUser: { type: Number, required: true, default: 5 },
    salesCount: {
        type: Number,
        default: 0
    },
    lastSoldDate: {
        type: Date
    }
}, { timestamps: true });

const Product = mongoose.model("Product",productSchema)
module.exports=Product