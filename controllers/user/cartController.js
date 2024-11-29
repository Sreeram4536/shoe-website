const Cart = require('../../models/cartSchema');  // Assuming you are using this path
const Product = require('../../models/productSchema');  // Assuming you have a product model for price reference
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');


// Add item to cart
// const addToCart = async (req, res) => {
//     try {
//         const {product_id} = req.params; // Extract product ID from params
//         const userId = req.session.user; // Get user ID from session

//         console.log("Product ID in cart:", product_id);

//         // Check if the product exists
//         const product = await Product.findById(product_id); // Query the product by ID
//         if (!product || product.quantity <= 0) {
//             return res.status(400).send("Product is out of stock");
//         }

//         // Find or create the user's cart
//         let cart = await Cart.findOne({ userId });

//         if (!cart) {
//             // Initialize a new cart with all required fields
//             cart = new Cart({
//                 userId,
//                 items: [
//                     {
//                         productId: product_id,
//                         quantity: 1,
//                         price: product.salePrice,
//                         totalPrice: product.salePrice,
//                         status: "placed",
//                         cancelationReason: "none",
//                     },
//                 ],
//             });
//         } else {
//             // Ensure cart.items is always an array
//             cart.items = cart.items || [];

//             // Check if the product is already in the cart
//             const existingItem = cart.items.find(item => item.productId.toString() === product_id);

//             if (existingItem) {
//                 // Update the quantity and totalPrice if the product already exists in the cart
//                 existingItem.quantity += 1;
//                 existingItem.totalPrice = existingItem.quantity * existingItem.price;
//             } else {
//                 // Add new product to the cart
//                 cart.items.push({
//                     productId: product_id,
//                     quantity: 1,
//                     price: product.salePrice, // Set price from the product's salePrice
//                     totalPrice: product.salePrice, // Initial totalPrice = price * quantity
//                     status: "placed", // Default status for a new cart item
//                     cancelationReason: "none", // Default cancelationReason
//                 });
//             }
//         }

//         await cart.save(); // Save the cart to the database
//         res.redirect('/user/cart'); // Redirect to the cart view
//     } catch (error) {
//         console.error("Error in addToCart:", error);
//         res.status(500).send('Server error');
//     }
// };

const addToCart = async (req, res) => {
    try {
        const product_id = req.params.product_id;
        const userId = req.session.user;

        console.log("Adding to cart - Product ID:", product_id, "User ID:", userId); // Debug log

        // Check if the product exists
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if product has stock
        if (product.quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Product is out of stock"
            });
        }

        // Find user's cart
        let cart = await Cart.findOne({ userId });
        
        if (!cart) {
            // Create new cart if it doesn't exist
            cart = new Cart({
                userId,
                items: [{
                    productId: product_id,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: "placed",
                    cancelationReason: "none",
                }]
            });
        } else {
            // Check if cart already has 3 different products
            if (cart.items.length >= 3 && !cart.items.find(item => item.productId.toString() === product_id)) {
                return res.status(400).json({
                    success: false,
                    message: "Cart cannot contain more than 3 different products"
                });
            }

            // Check if product already exists in cart
            const existingItem = cart.items.find(item => item.productId.toString() === product_id);

            if (existingItem) {
                // Check if new quantity would exceed stock
                if (existingItem.quantity + 1 > product.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot add more items. Only ${product.quantity} items available in stock`
                    });
                }
                
                existingItem.quantity += 1;
                existingItem.totalPrice = existingItem.quantity * existingItem.price;
            } else {
                // Add new item to cart
                cart.items.push({
                    productId: product_id,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: "placed",
                    cancelationReason: "none",
                });
            }
        }

        await cart.save();
        
        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully"
        });

    } catch (error) {
        console.error("Error in addToCart:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while adding to cart"
        });
    }
};
// Remove from Cart
const removeFromCart = async (req, res) => {
    try {
        const  product_id  = req.body.productId;
        const userId = req.session.user;
        console.log("rem cart",product_id);
        console.log(userId);
        
        
        

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).send("Cart not found");
        }

        // Remove the item from the cart
        // cart.items = cart.items.filter(item => item.productId.toString() !== product_id);
        // await cart.save();
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: product_id } } }
        );

        res.status(200).json({ message: 'Item removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// View Cart
const viewCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.user }).populate('items.productId','productName salePrice productImage');
        if (!cart) {
            return res.render('user/cart', { cart: null,session:req.session });
        }

        const totalCartPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        res.render('user/cart', { cart, totalCartPrice,session:req.sessiondth });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


// const updateQuantity = async (req, res) => {
//     try {
//         const { product_id, quantity } = req.body;
//         const userId = req.session.user; // Get user ID from session
        
        

//         const cart = await Cart.findOne({ userId });
//         if (!cart) {
//             return res.status(404).json({ message: "Cart not found" });
//         }

//         // Find the item in the cart that needs to be updated
//         const item = cart.items.find(item => item.productId.toString() === product_id);
//         if (!item) {
//             return res.status(404).json({ message: "Item not found in cart" });
//         }

//         // Update the item's quantity and totalPrice
//         item.quantity = quantity;
//         item.totalPrice = quantity * item.price;

//         await cart.save();

//         res.status(200).json({ message: 'Quantity updated successfully' });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Something went wrong while updating the cart.' });
//     }
// };



// Update quantity function with improved stock checking
const updateQuantity = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const userId = req.session.user;

        // Validate quantity is a positive number
        const newQuantity = parseInt(quantity);
        if (isNaN(newQuantity) || newQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid quantity"
            });
        }

        // Check product stock
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if requested quantity exceeds available stock
        if (newQuantity > product.quantity) {
            return res.status(400).json({
                success: false,
                message: `Cannot update quantity. Only ${product.quantity} items available in stock`
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(item => item.productId.toString() === product_id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        item.quantity = newQuantity;
        item.totalPrice = newQuantity * item.price;

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Quantity updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating the cart'
        });
    }
};


const checkoutPage = async (req, res) => {
    try {
        const userId = req.session.user; // Get the authenticated user's ID from the session

        // Fetch the user's cart and populate product details
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product', // Populate the product details (like name, price, image)
        });

        // If no cart or cart items, redirect to the cart page
        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }

        // Fetch the user's address document
        const addressDocument = await Address.findOne({ userId });

        // Get the array of addresses from the document, or default to an empty array
        const addresses = addressDocument ? addressDocument.address : [];

        // Calculate the total price for all items in the cart
        let totalAmount = 0;
        cart.items.forEach(item => {
            totalAmount += item.totalPrice; // Each item's totalPrice should already be calculated
        });

        // Render the checkout page with cart items, total amount, and addresses
        res.render('user/checkout', {
            cartItems: cart.items, // Send cart items to the frontend
            totalAmount: totalAmount, // Send the total amount to the frontend
            addresses: addresses, // Pass the array of addresses to the frontend
            session:req.session
        });
    } catch (err) {
        console.error('Error in checkout page:', err);
        res.redirect('/user/cart');
    }
};



// const placeOrder = async (req, res) => {
//     try {
//         const userId = req.session.user; // Ensure user is authenticated
//         const { chosenAddress } = req.body; // Extract address from the form
//         console.log("Chosen address ID from frontend:", chosenAddress);
//         // Fetch the user's cart
//         const userCart = await Cart.findOne({ userId }).populate('items.productId', 'productName salePrice quantity');
//         if (!userCart || userCart.items.length === 0) {
//             return res.status(400).send('Your cart is empty.');
//         }

//         // Validate the address
//         const userAddress = await Address.findOne({ userId, 'address._id': chosenAddress });
//         if (!userAddress) {
//             return res.status(404).send('Invalid address selected.');
//         }

//         const selectedAddress = userAddress.address.find(addr => addr._id.toString() === chosenAddress);
//         if (!selectedAddress) {
//             return res.status(404).send('Address not found.');
//         }

//         // Calculate total price
//         const totalPrice = userCart.items.reduce((total, item) => total + item.quantity * item.productId.salePrice, 0);
//         const discount = 0; // Add logic for discounts if applicable
//         const finalAmount = totalPrice - discount;

//         // Validate stock availability
//         for (const item of userCart.items) {
//             if (item.quantity > item.productId.quantity) {
//                 return res.status(400).send(`Insufficient stock for ${item.productId.productName}`);
//             }
//         }

//         // Create the order
//         const newOrder = new Order({
//             orderedItems: userCart.items.map(item => ({
//                 product: item.productId._id,
//                 quantity: item.quantity,
//                 price: item.productId.salePrice,
//             })),
//             userId,
//             totalPrice,
//             discount,
//             finalAmount,
//             address: chosenAddress,
//             invoiceDate: new Date(),
//             status: 'Pending', // Default order status
//             couponApplied: false, // Adjust if coupons are implemented
//         });

//         await newOrder.save();

//         // Update product quantities
//         for (const item of userCart.items) {
//             await Product.findByIdAndUpdate(item.productId._id, {
//                 $inc: { quantity: -item.quantity },
//             });
//         }

//         // Clear the user's cart
//         userCart.items = [];
//         await userCart.save();

//         // Redirect to a success page or render a confirmation
//         res.redirect(`/user/order-success?orderId=${newOrder._id}`);
//     } catch (error) {
//         console.error('Error placing order:', error);
//         res.status(500).send('Server Error');
//     }
// };

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { chosenAddress, paymentMethod } = req.body;

        // Fetch the user's cart
        const userCart = await Cart.findOne({ userId }).populate('items.productId');
        if (!userCart || userCart.items.length === 0) {
            return res.status(400).send('Your cart is empty.');
        }

        // Calculate total price
        const totalPrice = userCart.items.reduce((total, item) => 
            total + item.quantity * item.productId.salePrice, 0);
        const discount = 0;
        const finalAmount = totalPrice - discount;

        // Create new order
        const newOrder = new Order({
            orderedItems: userCart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
            })),
            userId,
            totalPrice,
            discount,
            finalAmount,
            address: chosenAddress, // Pass the address ID directly
            status: paymentMethod === 'COD' ? 'Pending' : 'Awaiting Payment',
            invoiceDate: new Date(),
            couponApplied: false
        });

        await newOrder.save();

        // Update product quantities
        for (const item of userCart.items) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity }
            });
        }

        // Clear cart
        userCart.items = [];
        await userCart.save();

        res.redirect(`/user/order-success?orderId=${newOrder._id}`);
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send('Server Error');
    }
};

const paymentPage = async (req, res) => {
    try {
        const userId = req.session.user;

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }

        // Calculate total amount
        const totalAmount = cart.items.reduce((total, item) => 
            total + (item.quantity * item.productId.salePrice), 0);

        // Fetch the address document
        const addressDocument = await Address.findOne({ userId });
        if (!addressDocument) {
            return res.status(404).send('Address document not found');
        }

        // Find the specific address from the address array
        const selectedAddress = addressDocument.address.find(
            addr => addr._id.toString() === req.body.chosenAddress
        );

        if (!selectedAddress) {
            return res.status(404).send('Selected address not found');
        }

        res.render('user/payment', {
            selectedAddress,
            totalAmount,
            session: req.session
        });

    } catch (err) {
        console.error('Error in payment page:', err);
        res.redirect('/user/checkout');
    }
};


const orderSuccess = async(req,res)=>{
    try {
        const orderId = req.query.orderId;
        console.log(orderId);
        
        // const orderData = await Order.findById(orderId);
    if (!orderId) {
        return res.status(400).send('Order ID is required.');
    }
    req.session.orderId = orderId;
    res.render('user/order-success', { orderId,session:req.session });
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}



    

module.exports = {
    addToCart,
    viewCart,
    removeFromCart,
    updateQuantity,
    checkoutPage,
    placeOrder,
    paymentPage,
    orderSuccess
};