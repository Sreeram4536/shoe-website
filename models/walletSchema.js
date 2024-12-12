const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [{
        transactionId: {
            type: String,
            required: true,
            unique: true
        },
        amount: {
            type: Number,
            required: true
        },
        type: {
            type: String,
            enum: ['Credit', 'Debit'],
            required: true
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order"
        },
        status: {
            type: String,
            enum: ['Success', 'Failed', 'Pending'],
            default: 'Success'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // This will add createdAt and updatedAt fields automatically
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;