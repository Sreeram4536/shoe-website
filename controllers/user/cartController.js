const Cart = require('../../models/cartSchema');  // Assuming you are using this path
const Product = require('../../models/productSchema');  // Assuming you have a product model for price reference
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');


// Add item to cart
const addToCart = async (req, res) => {
    try {
        const userId = req.session.user; // Authenticated user ID
        const { productId } = req.params; // Product ID from route

        // // Validate if productId is a valid ObjectId
        // if (!mongoose.Types.ObjectId.isValid(productId)) {
        //     return res.status(400).json({ status: false, message: 'Invalid Product ID.' });
        // }

        // Find the product in the database
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ status: false, message: 'Product not found.' });
        }

        if (product.quantity < 1) {
            return res.status(400).json({ status: false, message: 'Product out of stock.' });
        }

        // Find or create the user's cart
        let userCart = await Cart.findOne({ userId });
        if (!userCart) {
            userCart = new Cart({
                userId,
                items: [],
            });
        }

        // Check if the product is already in the cart
        const existingItem = userCart.items.find(item => item.productId.toString() === productId);

        if (existingItem) {
            // Update quantity and total price
            existingItem.quantity += 1;
            existingItem.totalPrice = existingItem.quantity * product.salePrice;
        } else {
            // Add the product to the cart
            userCart.items.push({
                productId,
                quantity: 1,
                price: product.salePrice,
                totalPrice: product.salePrice,
            });
        }

        // Save the cart
        await userCart.save();

        res.redirect('/user/cart'); // Redirect to cart page
    } catch (error) {
        console.error("Error adding item to cart:", error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};

// View cart
// const viewCart = async (req, res) => {
//     try {
//         const userId = req.session.user; // Authenticated user ID

//         // Find the user's cart and populate product details
//         const userCart = await Cart.findOne({ userId }).populate('items.productId', 'productName salePrice productImage');

//         if (!userCart || userCart.items.length === 0) {
//             return res.render('user/cart', {
//                 message: 'Your cart is empty.',
//                 cartItems: [],
//                 totalAmount: 0,
//             });
//         }

//         // Calculate total amount
//         const totalAmount = userCart.items.reduce((total, item) => total + item.totalPrice, 0);

//         res.render('user/cart', { cartItems: userCart.items, totalAmount });
//     } catch (error) {
//         console.error("Error viewing cart:", error);
//         res.status(500).json({ status: false, message: 'Internal Server Error' });
//     }
// };

const viewCart = async (req, res) => {
    try {
        const userId = req.session.user; // Authenticated user ID

        // Find the user's cart and populate product details
        const userCart = await Cart.findOne({ userId }).populate('items.productId', 'productName salePrice productImage');

        if (!userCart || userCart.items.length === 0) {
            return res.render('user/cart', {
                message: 'Your cart is empty.',
                cartItems: [],
                totalAmount: 0,
                session:req.session
            });
        }

        // Calculate total amount
        const totalAmount = userCart.items.reduce((total, item) => total + item.totalPrice, 0);

        res.render('user/cart', { cartItems: userCart.items, totalAmount,session:req.session });
    } catch (error) {
        console.error("Error viewing cart:", error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};


// Remove item from cart
const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user; // Get authenticated user ID from session
        const { productId } = req.params; // Get productId from route params

        // Find the user's cart
        const userCart = await Cart.findOne({ userId });
        if (!userCart) {
            return res.status(404).json({ status: false, message: 'Cart not found.' });
        }

        // Find the index of the product to be removed
        const itemIndex = userCart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ status: false, message: 'Product not found in cart.' });
        }

        // Remove the product from the cart
        userCart.items.splice(itemIndex, 1); // Remove item from array

        // Check if the cart is now empty after removal
        if (userCart.items.length === 0) {
            await Cart.deleteOne({ userId }); // Delete the entire cart if empty
            return res.render('user/cart', {
                message: 'Your cart is empty.',
                cartItems: [],
                totalAmount: 0,
                session:req.session
            });
        }

        // Save the updated cart if there are still items left
        await userCart.save();

        // Redirect to the updated cart page
        res.redirect('/user/cart');
    } catch (error) {
        console.error("Error removing item from cart:", error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};




// Update quantity of cart item
const updateCartQuantity = async (req, res) => {
    try {
        const userId = req.session.user; // Authenticated user ID
        const { productId, quantity } = req.body; // Arrays of productId and quantity from the form
        console.log('Received product IDs:', productId);

        // Ensure both arrays are provided and have matching lengths
        if (!productId || !quantity || productId.length !== quantity.length) {
            return res.status(400).json({ message: 'Invalid data.' });
        }

        // Find the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        // Loop through the items to update their quantities
        for (let i = 0; i < productId.length; i++) {
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId[i]);
            if (itemIndex !== -1) {
                // Get the product and the new quantity
                const product = await Product.findById(productId[i]);
                const newQuantity = parseInt(quantity[i], 10);

                // Ensure the product exists and check stock availability
                if (!product) {
                    return res.status(404).json({ message: `Product not found for ID ${productId[i]}` });
                }

                // Allow the quantity to be reduced to zero (removal of product)
                if (newQuantity < 0 || newQuantity > product.quantity) {
                    return res.status(400).json({ message: `Insufficient stock for product ${product.productName}` });
                }

                // Update the cart item quantity and total price
                cart.items[itemIndex].quantity = newQuantity;
                cart.items[itemIndex].totalPrice = product.salePrice * newQuantity;

                // If quantity is reduced to zero, remove the item from the cart
                if (newQuantity === 0) {
                    cart.items.splice(itemIndex, 1); // Remove the item
                }
            }
        }

        // Save the updated cart
        await cart.save();

        res.redirect('/user/cart');
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
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



const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user; // Ensure user is authenticated
        const { chosenAddress } = req.body; // Extract address from the form
        console.log("Chosen address ID from frontend:", chosenAddress);
        // Fetch the user's cart
        const userCart = await Cart.findOne({ userId }).populate('items.productId', 'productName salePrice quantity');
        if (!userCart || userCart.items.length === 0) {
            return res.status(400).send('Your cart is empty.');
        }

        // Validate the address
        const userAddress = await Address.findOne({ userId, 'address._id': chosenAddress });
        if (!userAddress) {
            return res.status(404).send('Invalid address selected.');
        }

        const selectedAddress = userAddress.address.find(addr => addr._id.toString() === chosenAddress);
        if (!selectedAddress) {
            return res.status(404).send('Address not found.');
        }

        // Calculate total price
        const totalPrice = userCart.items.reduce((total, item) => total + item.quantity * item.productId.salePrice, 0);
        const discount = 0; // Add logic for discounts if applicable
        const finalAmount = totalPrice - discount;

        // Validate stock availability
        for (const item of userCart.items) {
            if (item.quantity > item.productId.quantity) {
                return res.status(400).send(`Insufficient stock for ${item.productId.productName}`);
            }
        }

        // Create the order
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
            address: chosenAddress,
            invoiceDate: new Date(),
            status: 'Pending', // Default order status
            couponApplied: false, // Adjust if coupons are implemented
        });

        await newOrder.save();

        // Update product quantities
        for (const item of userCart.items) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity },
            });
        }

        // Clear the user's cart
        userCart.items = [];
        await userCart.save();

        // Redirect to a success page or render a confirmation
        res.redirect(`/user/order-success?orderId=${newOrder._id}`);
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send('Server Error');
    }
};

const paymentPage = async (req, res) => {
    try {
        const userId = req.session.user; // Get the authenticated user's ID from the session

        // Fetch the user's address document
        const addressDocument = await Address.findOne({ userId });

        // Get the array of addresses from the document
        const addresses = addressDocument ? addressDocument.address : [];

        // Ensure addresses exist and the index is valid
        if (addresses.length === 0) {
            return res.status(400).send('No addresses available. Please add an address before proceeding.');
        }

        // Extract the index of the selected address from the form submission
        const addressIndex = parseInt(req.body.chosenAddress, 10); // Convert to integer

        // Check if the address index is valid
        if (isNaN(addressIndex) || addressIndex < 0 || addressIndex >= addresses.length) {
            return res.status(400).send('Invalid address selected.');
        }

        // Get the selected address based on the index
        const selectedAddress = addresses[addressIndex]; // Get the selected address based on the index

        // Proceed with payment process using the selected address
        console.log('Selected Address:', selectedAddress);

        // You can now use the selected address for further processing (e.g., payment gateway integration)

        // Render the payment page or proceed to the next step
        res.render('user/payment', { selectedAddress, totalAmount: req.body.totalAmount ,session:req.session});

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
    updateCartQuantity,
    checkoutPage,
    placeOrder,
    paymentPage,
    orderSuccess
};