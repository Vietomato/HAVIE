export const categories = ["All","Rackets","Shoes","Apparel","Accessories"];
export const products = [
 {id:1,name:"HAVIE Attack Pro",category:"Rackets",price:1290000,oldPrice:1590000,rating:4.9,badge:"BEST SELLER",tone:"sage",description:"An agile carbon-frame racket for confident attacking play.",specs:["4U / G5","High modulus carbon","Medium-stiff shaft"]},
 {id:2,name:"HAVIE Court X",category:"Shoes",price:1150000,rating:4.8,badge:"NEW",tone:"cream",description:"Stable, responsive court shoes built for quick direction changes.",specs:["Non-marking outsole","Breathable mesh","Enhanced heel support"]},
 {id:3,name:"HAVIE Tour 88",category:"Rackets",price:1890000,rating:4.9,badge:"POPULAR",tone:"sand",description:"Precision and control for every rally.",specs:["3U / G5","Isometric frame","Stiff shaft"]},
 {id:4,name:"HAVIE Power Tee",category:"Apparel",price:390000,rating:4.7,badge:"",tone:"sage",description:"Lightweight quick-dry performance apparel.",specs:["Quick-dry","Unisex","Easy movement"]},
 {id:5,name:"HAVIE Aero Lite",category:"Rackets",price:990000,rating:4.7,badge:"",tone:"cream",description:"Fast handling and effortless defensive recovery.",specs:["5U / G5","Lightweight frame","Flexible shaft"]},
 {id:6,name:"HAVIE Grip Set",category:"Accessories",price:149000,rating:4.6,badge:"VALUE",tone:"sand",description:"Comfortable overgrips for confident control.",specs:["Pack of 3","Sweat absorbing","Soft touch"]},
 {id:7,name:"HAVIE Sprint 2",category:"Shoes",price:1390000,rating:4.8,badge:"NEW",tone:"sage",description:"Reliable traction for competitive footwork.",specs:["Court traction","Cushioned midsole","Reinforced toe"]},
 {id:8,name:"HAVIE Match Kit",category:"Accessories",price:590000,rating:4.7,badge:"",tone:"cream",description:"Everyday essentials for training days.",specs:["Compact carry","Training essentials","Durable finish"]}
];
export const money = value => new Intl.NumberFormat("en-US",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(value);
