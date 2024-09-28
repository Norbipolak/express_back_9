import express from "express";
import expressEjsLayouts from "express-ejs-layouts";
import UserHandler from "./app/userHandler,js"; 
import session from "express-session"
import successHTTP from "./app/successHTTP.js";
import Addresses from "./app/Addresses.js";
import getMessageAndSuccess from "./app/getMessageAndSuccess.js";
import checkPermission from "./app/checkPermission.js";

const app = express();

app.set("view engine", "ejs");
app.use(expressEjsLayouts);
app.use(urlencoded({extended: true}));
app.use(express.static("assets"));

app.use(session());

app.use(session({
    secret: "asdf",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24*60*60*1000
    }
}));

const uh = new UserHandler();
const p = new Profile(); 
const a = new Addresses();

app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
});

app.post("/regisztracio", async (req, res)=> {
    let response;
    try {
        response = await uh.register(req.body); 
    } catch (err) {
        response = err;
    }

    //response.success = response.status.toString(0) === "2";
    response.success = successHTTP(response.status);
    res.status(response.status);

    res.render("public/register_post", {
        layout: "./layout/public_layout",
        message: response.message,
        title: "Regisztráció",
        baseUrl: process.env.BASE_URL,
        page: "regisztracio", 
        success: response.success
    })
});

app.post("/login", async (req, res)=> {
    let response;
    let path;

    try{
        response = uh.login(req.body);
        req.session.userName = response.userName;
        req.session.userID = response.userID;

        path = response.message.isAdmin == 0 ? "/user/profil" : "/admin/profil"
    } catch(err) {
        response = err;
    }

    response.success = successHTTP(response.status);


    res.status(response.status).redirect(
        response.success ? path : `/bejelentkezes?message=${response.message[0]}`
    )

})

app.get("/bejelentkezes", (req, res)=> {
    res.render("public/login", {
        layout: "./layouts/public_layout",
        title: "Bejelentkezés",
        baseUrl: process.env.BASE_URL,
        page: "bejelentkezes",
        message: req.query.message ? req.query.message : ""
    })
});

app.get("/user/profil", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const profileData = await p.getProfile(req.session.userID);
        //const messages = req.query.messages.split(",");
        /*
            Mert a getProfile függvény vár egy id-t és az alapján lehozza az összes (*) adatot, ahhoz az id-ű rekordhoz 
        */
        //csináltunk egy segédfüggvényt
        const messageAndSuccess = getMessageAndSuccess(req.query);
        
        res.render("private/profile", {
            layout: "./layouts/user_layout",
            title: "Profil Szerkesztése",
            baseUrl: process.env.BASE_URL,
            profileData: profileData.message, //itt meg megszerezzük az összes mezőt az adatbázisból 
            page: "profil", 
            message: messageAndSuccess.message,
            success: messageAndSuccess.success
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    }   
});

app.post("/user/profil", async (req, res)=> {
    let response;

    try {
        const user = req.body;
        user.userID = req.session.userID;
        response = await p.updateProfile(user);
    } catch(err) {
        response = err;
    }

    console.log(response);

        
    const success = successHTTP(response.status);
    res.redirect(`/user/profil?success=${success}&messages=${response.message}`);
});

app.get("/user/cim-letrehozasa", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            page: "címek",
            addressTypes: addressTypes,
            baseUrl: process.env.BASE_URL,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:{}
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
   
});

app.post("/user/create_address", async (req, res)=> {
    //itt szedjük majd le az adatokat 
    let response;

    try {
        response = await a.createAddress(req.body, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.status);

    if(success) {
        res.status(response.status).redirect(`/user/cim-letrehozasa/${response.insertID}?message=${response.message}&success=${success}`);
    } else {
        res.status(response.status).redirect(`/user/cim-letrehozasa?message=${response.message}&success=${success}`);
    }
    
});

app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const address = await a.getAddressByID(req.params.addressID, req.session.userID);
        console.log(address);
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            baseUrl: process.env.BASE_URL,
            page: "címek",
            addressTypes: addressTypes,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:address
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
});

app.post()

app.get("/user/címek", async (req, res)=> {
    let response;

    try {
        checkPermission(req.session.userID),
        response = await a.getAddressesByUser(req.session.userID);
    } catch(err) {
        if(err.status === 403) {
            res.redirect(`/message=${err.message}`);
        }
        response = err;
    }

    res.render("user/addresses", { 
        layout: ".layout/user_layout",
        addresses: response.message,
        baseUrl: process.env.BASE_URL,
        title: "Címek", 
        page: "címek"
    })
});

app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
    /*
        fontos, hogy azokat ami egy url változó query, azt ?xx=xx formátumba kell csinálni   
    */
})

app.listen(3000, console.log("the app is listening on localhost:3000"));

/*
    És ez azért kellett nekünk, hogy leszedjük a címeket id alapján, mert most a címeknél ott van az összes címünk, amit felvittünk a user/
    cim-letrehozosa-val (create-address.ejs)
    itt megszerezzük a címet addressID alapján (Addresses.js)
        async getAddressByID(addressID, userID) {
    itt az index-en, meg kell csinálni egy get-eset neki 
    app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {

    És akkor a címeknél rá tudunk menni egy adott címre, mert lesz egy megnyitás gomb benne és utána meg felül tudjuk írni 

    app.get("/user/címek", async (req, res)=> {
    let response;

    try {
        checkPermission(req.session.userID),
        response = await a.getAddressesByUser(req.session.userID);
    } catch(err) {
        if(err.status === 403) {
            res.redirect(`/message=${err.message}`);
        }
        response = err;
    }

    res.render("user/addresses", { 
        layout: ".layout/user_layout",
        addresses: response.message,    ****
        title: "Címek", 
        page: "címek"

    Az a fontos, hogy ebben a response-ban meg kell, hogy kapjuk az adott címeknek az id-ját is, mert ez szükséges a felülíráshoz 
    És az addresses.ejs-nél, amit megjelenítünk itt ott amikor végigmegyünk az addresses-eken (addresses: response.message), akkor 
    lesz mindegyiknél egy link 

            <% addresses.forEach((a)=> {%>
            <div class="box">
                <h3>Cím típusa</h3>
                <h4><%=a.addressTypeName%></h4>

                <h3>Írányítószám/város</h3>
                <h4><%=a.postalCode%> <%=a.settlement%></h4>

                <h3>Utca/Házszám</h3>
                <h4><%=a.street%> <%=a.houseNumber%></h4>

                <h3>Emelet/Ajtó</h3>
                <h4><%=a.floorNumber%> <%=a.doorNumber%></h4>

               // <a href="http://localhost:3000/user/cim-letrehozasa?addressID=<%=a.addressID%>">Megnyitás</a>    ****************
               ->
               <a href="http://localhost:3000/user/cim-letrehozasa/<%=a.addressID%>">Megnyitás</a>
            </div>

És ha rányomunk most valamelyik címnél az egyik címre, akkor ide visz minket (mondjuk az elsőre kattintunk rá)
->
localhost:3000/user/cim-letrehozasa?addressID=1    
És akkor itt automatikusan ki kell majd tölteni az adatokat a form-ban az adott cím adataival, amit megnyitottunk 
************************************************************************************************************************************
Nem akarja behozni a css-t és ennek az az oka, hogy egyel több / van 
->
localhost:3000/user/cím-letrehozasa/2 (emiatt /2)
és nem találta meg itt a css-t 
-> 
Meg kell határozni egy baseURL-t, hogy honnan szedi le az adatokat 
-> 
npm i dotenv
csinálunk egy ilyen fájlt, hogy .env
BASE_URL=http://localhost:3000
DB_HOST=127.0.0.1 
DB_USER=root
DB_NAME=webshop
DB_PASS=

Ezek az adatok globálisan vannak meghatározva és hogyha kicseréljük őket és újrainditjuk a szervert, akkor már msáképpen próbál meg csatlakozni 
az adatbázishoz, más lesz a baseURL 

Ezt ide a dotenv-et be kell importálni -> import dotenv from 'dotenv'
dotenv.config()

console.log(process.env.BASE_URL) -> localhost:3000 (így férhetünk hozzá, hogy process.env)
console.log(process.env.DB_USER) -> root 

Ez azért jó, mert ha bedobjuk az egészet GitHub-ra, akkor magát a dotenv (.env) fájlt nem fogjuk és a GitHub-ról nem lehet majd leolvasni 
ezeket a sensitive adatokat!!!!!!!!!!!!!!!!

Mindemelett globálisan tudjuk változtatni ezeket a dolgokat és nem kell mindenhol átírogatni ezeket, hogyha esetleg módosul
és a conn-ban meg át kell írni 
function conn() {
    const conn = mysql2.createConnection({
        host: "127.0.0.1",
        user: "root",
        password: "",
        database: "webshop"
    })
}
->
még sem jó ha a dotenv az ide az index-re van importálva meg config-olva, hanem ennek a conn-on kell így 
->
import mysql2 from "mysql2";
import dotenv from 'dotenv';
dotenv.config()

function conn() {
    const conn = mysql2.createConnection({
        host: process.env.DB_HOST,                  ********
        user: process.env.DB_USER,                  ********
        password: process.env.DB_PASS,              ********
        database: process.env.DB_NAME               ********
    })
}

Ebben a fáljban kell ezt megcsinálni!!! 
A conn-ra mindegyik osztály hivatkozik és ezért már az elején megcsinálja ezt a dotenv-es dolgot 

De ha most az index-js-en ki próbáljuk írni, hogy console.log(process.env.
Akkor azt itt is látni fogja -> 
BASE_URL: 'localhost:3000'
DB_HOST: '127.0.0.1'
DB_NAME: 'webshop'
DB_PASS: ''
DB_USER: 'root'
meg még sok más adat 

És ezt kell átadni a layout-oknak 
<%-include("../common/head", {title: title})%> 
Mindenhol meg kell adni egy title-t és mindegyiknél meg kell majd adni egy base_url-t is!!! 
máshogyan nem tudunk hozzáférni a ejs fájlból, kénytelenek vagyunk mindenhol így átadogatni 
app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
});

és mindenhol ahol van render (layout) ott át kell adni ezt a baseUrl-t is 
app.get("/", (req, res)=> {
    res.render("public/index", 
        {
            layout: "layouts/public_layout", 
            title: "Kezdőlap", 
            baseUrl: process.env.BASE_URL,                ****************    meg mindegyik render-nél ugyanígy 
            page:"index",
            message:req.query.message ? req.query.message : ""
        }
    );
}); 

És ha mindenhol így átadtuk, akkor a user meg a public layout-on is a title mellett vár egy baseUrl-t 
<%-include("../common/head", {title: title, baseUrl: baseUrl})%>

A commen/head.ejs-ben meg nem a ../style.css-t választjuk 
<link rel="stylesheet" href="../common/style.css">
Mert ezzel az a probléma, hogy ../ az addig jó, amig mindig ugyanannyi számú slash (/) van a localhost után 
user/profil mindig ugyanannyi user/cim-letrehozasa stb 
de viszont ha nem ugyanannyi (/user/cim-letrehozasa/2), akkor az történik, hogy már nem találja meg  
mert nem ../ hanem ../../-nek kell lennie 
és ezért inkább ezt fogjuk csinálni, hogy van itt egy baseUrl és azt fogjuk kiírni és akkor így már müködik
->
<link rel="stylesheet" href="<%=baseUrl%>style.css">
Az a lényeg, hogy nem mindegy, hogy melyik könyvtárban vagyunk!!!!! 
*************************************************************************************************************************************
Most kellene egy update-s valami az addressID-nál -> app.get("/user/cim-letrehozasa:addressID"
itt az id alapján a címet le kell hozni, erre csináltuk a getAddressByID-t az Addresses.js-en  async getAddressByID(addressID, userID) {
const address = await a.getAddressByID(req.params.addressID, req.session.userID);
console.log(address);
addressID: 1,
addressType: 1,
userID: 6,
postalCode: 1157,
settlement: 'Budapest'
street: 'Akármi utca',
houseNumber: '50',
floorNumber: '6',
doorNumber: '10',
created: 2024-09-23T08:13:37.000    
updated: null, 
addressTypeName: 'számlázási'

async getAddressByID(addressID, userID) {
...
    if(response[0].length > 0) {
        return {
            status: 200,
            message: response[0][0] ** nem úgy, hogy response[0]

Mert ha response[0][0], akkor jön le az az egyetlen cím 

app.get("/user/cim-letrehozasa:addressID", async (req, res)=> {
    try {
        checkPermission(req.session.userID);
        const addressTypes = await a.getAddressTypes();
        const messageAndSuccess = getMessageAndSuccess(req.query);
        const address = await a.getAddressByID(req.params.addressID, req.session.userID);   *******
    
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            baseUrl: process.env.BASE_URL,
            page: "címek",
            addressTypes: addressTypes,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:address.message                            *************
        })
    } catch(err) {
        res.redirect(`/?message=${err.message}`);
    } 
});

Itt van a probléma, hogy ugyabban az ejs fájlban vagyunk, mint amikor létrehozzuk a címet 
ott is res.render("user/create_address" az app.get("/user/cim-letrehozasa"-nál

Mindegyiknél a cím létrehozásánál és a cím felülírásánál is létrehozunk egy olyat, hogy address-t 
app.get("/user/cim-letrehozasa", async (req, res)=> {
.....
        res.render("user/create_address", {
            layout: "./layouts/user_layout", 
            title: "Címek létrehozása", 
            page: "címek",
            addressTypes: addressTypes,
            baseUrl: process.env.BASE_URL,
            message: messageAndSuccess.message,
            success: messageAndSuccess.success,
            address:{}                                   ******

Csak ahol létrehoztuk ott egy üres {} lesz, ott ahol meg felül akarjuk írni, ott meg az address.message, amit megszereztünk az adatbázisból!!!!! 
->    
const address = await a.getAddressByID(req.params.addressID, req.session.userID);

És a create-address.ejs-en megadjuk a value-kat úgy, hogyha létezik az address.postalCode meg a többi ugyanígy akkor írjuk ki a value-ban 
az értéket 
Tehát az a lényeg, hogy ugyanazt az ejs fájlt (form-ot) alkalmazzuk amikor elöször fel akarjuk vinni az adatokat, meg amikor meg vannak 
és felül akarjuk írni őket, amikor felülírás van, akkor meg akarjuk jeleníteni az adott cím adatait, ezt szedtük le az adatbázisból 
const address = await a.getAddressByID(req.params.addressID, req.session.userID); és adtuk át render-elésnél -> address:address.message 

create.address
        <h3>Írányítószám</h3>
        <input type="text" name="postalCode" value="<%=address.postalCode ? address.postalCode : ''>">

        <h3>Település</h3>
        <input type="text" name="settlement" value="<%=address.settlement ? address.settlement : ''>">

        <h3>Közterület neve és jellege</h3>
        <input type="text" name="street" value="<%=address.street ? address.street : ''>">

Az a kérdés, hogy hogyan tudjuk a cím típusát, mert ez egy select mező 
-> 
    <h3>Cím típusa</h3>
    <select name="addressType">
        <option value="0">Válassz típust</option> 
        <% addressTypes.forEach((a)=> { %>
            <option value="<%= a.typeID %>"><%= a.typeName %></option>
        <% }) >% 
    </select>

A getAddressByID ott még le kell szedni a types_address tablából a typeID-t is 
    async getAddressByID(addressID, userID) {
....
            const response = await conn.promise().query(`
                SELECT addresses.*, types_address.typeID as addressTypeID ****
                types_address.typeName as addressTypeName

Ha a typeID az egyenlő address.addressTypeID-val, akkor selected lesz ha meg nem, akkor egy üres string 
Tehát lejön egy addressTypeID és ha az ugyanaz ami a forEach-ben volt, akkor azt kijelöljük 
-> 
    <% addressTypes.forEach((a)=> { %>
        <option <%=a.typeID == address.addressTypeID ? "selected" : ""%>   ***************
        value="<%= a.typeID %>"><%= a.typeName %></option>
Fontos, hogy itt selected kell, nem checked, checked az a checkbox-nál van, ez meg egy select és itt checked van!!!!! 

Ha ez meg van akkor csinálunk egy updateAddress-t az Addresses.js-en 
-> 
    async updateAddress(address, userID) {
Itt kell nekünk az errors meghívni, megszerezni és a checkPermission (mert az már mindenhova kell nagyjából)
->
    async updateAddress(address, userID) {
        const errors = this.checkData(address);
        checkPermission(userID);

Kell egy try-catch blokk és ott meg az await conn.promise().query() 
->
    try {
        const response = conn.promise().query(`
            UPDATE address SET addressType = ?, 
            postalCode = ?, settlement = ?, street = ?, houseNumber = ?, floorNumber = ?, doorNumber = ?
            WHERE addressID = ? 
            AND userID = ?`
            [address.addressType, address.postalCode, address.settlement]    
        )
És nem csak az kell, hogy addressID = ? hanem az is, hogy userID = ? 
Mert ilyenkor ha az addressID nem ehhez a user-hez kapcsolodik, valaki trükközni szeretne, akkor nem tud, mert userID nem hozzá tartozik

És ha itt trim()-elni, akarunk 
[address.addressType, address.postalCode, address.settlement]
Akkor van erre egy megoladás, hogy nem muszály mindegyikre odaírni, hogy address.settlement.trim() meg address.postalCode.trim() 
-> 
Csinálunk egy segédfüggvényt, hogy trim.js elmagyarázással, ezt meghívjuk az address-re, amit bekér a függvény 
Azt a címet amit update-elni, akarunk (az egy objektum lesz ugye, ezekkel, hogy postalCode valami, amit beírunk, street, settlement stb)
-> 
    async updateAddress(address, userID) {
....
    try {
        address = trim(address);   ****

    try {
        address = trim(address);
        const response = conn.promise().query(`
            UPDATE address SET addressType = ?, 
            postalCode = ?, settlement = ?, street = ?, houseNumber = ?, floorNumber = ?, doorNumber = ?
            WHERE addressID = ? 
            AND userID = ?`
            [address.addressType, address.postalCode, address.settlement, 
            address.street, address.houseNumber, address.doorNumber, address.addressID, userID]

Csinálunk egy post-os kérést (igazából ez put lenne, csak itt csak post van ilyenkor) hogy megszerezzük az adatokat, amivel majd itt 
update-elünk!! 
        
Tehát itt visszakapunk egy req.body, de mi azt szeretnénk, hogy ebbe az objektumba benne legyen az addressID, ami itt van 
user/cím-letrehozasa/:addressID, tehát ennek az értéke kell az addressID-nak, hogy 1,2 vagy valamilyen szám 

const address = req.body;   ->  it lementjük az input-ból bejővő dolgokat, ez egy objektum lesz, olyan kulcsokkal ami a formban name-ként van
address.addressID = req.params.addressID;  -> itt belerakunk ebbe az objektumba egy kulcsot addressID, aminek az értéke req.params.addressID
    tehát ez -> :addressID

És ha ez meg van, akkor átadjuk az a.updateAddress-nek 
    az address-t, ami a req.body kiegészítve a req.session.params-val meg a userID-t, ami a req.session.userID-ből jön!!!!! 
->
response = await a.updateAddress(address, req.session.userID);

Most azt kell csinálni, hogy van ez a form(create-address.ejs), ami oda írányít át minket, hogy /user/create-address
És akkor az egész post is menjen erre, hogy create-address 
<form class="box" method="POST" action="/user/create_address">
-> 
user/cím-letrehozasa/:addressID"
->
user/create-address/:addressID"

És mivel a létrehozásra meg az update-re is ugyanazt a form-ot használjuk 
<form class="box" method="POST" action="/user/create_address">
->
action="/user/create_address/<%=address.addressID ? address.addressID : ""%>">

Most a /címek-en vagyunk és ott vannak a felvitt címeink ott van egy button és ha azt megnyonjuk, akkor átvisz minket erre a form-ra 
és az lesz az url, hogy /user/cim-letrehozasa/1 
Ha meg a címeken csak arra megyünk, hogy cím létrehozása button (tehát egy újnak a felvitele), akkor meg az url simán /user/cim-letrehozasa lesz 

tehát az elsőnél az action 
action="/user/create-address/1"
a másodiknál meg 
action="/user/create_address/"> / az nem zavar minket, hogy ott van 

    async updateAddress(address, userID) {
        const errors = this.checkData(address);
        checkPermission(userID);

        if(errors.length > 0) {
            throw {
                status: 400,
                message: errors
            }
        }

        try {
            address = trim(address);
            const response = conn.promise().query(`
                UPDATE address SET addressType = ?, 
                postalCode = ?, settlement = ?, street = ?, houseNumber = ?, floorNumber = ?, doorNumber = ?
                WHERE addressID = ? 
                AND userID = ?`
                [address.addressType, address.postalCode, address.settlement, 
                address.street, address.houseNumber, address.doorNumber, address.addressID, userID]
            )

            if(response[0].affectedRows === 1) {
                return {
                    status: 200,
                    message: ["Sikeres módosítás!"]
                }
            } else {
                //ha nem sikerült módosítani, akkor feltehetően nincsen ilyen bejegyezés az adatbázisban 
                throw {
                    status: 404,
                    message: ["A bejegyzés nem található az adatbázisban!"]
                }
            }

És akkor teljesen felül tudjuk írni és elmenteni a meglévő cimeinket!! 

app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}`);

Ha valami nem töltünk ki és úgy probáljuk beküldeni, akkor kiírja, hogy töltsd ki zöldel (nem pirossal) 
mert itt nincs olyan, hogy success, ott meg az alapján kapja meg a class-t 

        <% message.forEach((m)=> {%>
            <h4 class="<%=success ? 'color-success' : 'color-error'%>">
                <%=m%>
            </h4>
        <% }); %>

ezért kell itt nekünk successHTTP()-t meghívni
-> 
const success = successHTTP(response.success);
és ezt még benne kell, hogy legyen az url-ben is 
res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
-> 
app.post("user/create-address/:addressID", async (req, res)=> {
    let response;

    try {
        const address = req.body;
        address.addressID = req.params.addressID;
        response = await a.updateAddress(address, req.session.userID);
    } catch(err) {
        response = err;
    }

    const success = successHTTP(response.success);
    res.redirect(`/user/cim-letrehozasa/${req.params.addressID}?message=${response.message}&success=${success}`);
*/
