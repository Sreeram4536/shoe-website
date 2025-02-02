const mongoose=require('mongoose');
const {Schema}= mongoose;
const {v4:uuidv4}=require('uuid')



const orderSchema= new mongoose.Schema({
    userId:{
        type:Schema.Types.ObjectId,
            ref:"User",
            required:true
    },
    
    orderId:{
        type:String,
        default:()=>uuidv4().replace(/-/g, '').slice(0, 6),
        unique:true
    },
    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    address:{
        type:Schema.Types.ObjectId,
        ref:"Address",
        required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:['Pending','Processing','Shipped','Delivered','Cancelled','Returned','Return Approved','Return Rejected']
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Wallet', 'RazorPay']
    },
    
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    }
})

const Order=mongoose.model('Order',orderSchema);
module.exports=Order