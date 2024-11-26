const User = require("../../models/userSchema")
const mongoose=require('mongoose');
const bcrypt = require("bcrypt");

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

const loadDashboard = async(req,res)=>{
    if(req.session.admin){
        try {
            res.render('admin/dashboard')
        } catch (error) {
            res.redirect('/admin/pageerror')
        }
    }
}

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
    logout
}