import express from "express";
import sqlite3  from "sqlite3";
import { open } from "sqlite";
import { nanoid } from "nanoid";
import path from "path";
import QRCode from "qrcode";

const app = express();
const port = process.env.PORT || 3001;

/// database
const dbPromise = open({
    filename: path.join(__dirname, "db.sqlite"), // db file with a very basic name
    driver: sqlite3.Database, // sqlite3 driver -- very easy to manage
});

(async () => {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS urls ( 
        id TEXT PRIMARY KEY,
        longUrl TEXT NOT NULL,
        clicks INTEGER DEFAULT 0
        )
        `) // create table if not exists, with id and longUrl columns (id is primary key)
})();
// END

// middleware
app.set("view engine", "ejs"); // set view engine to ejs
app.set("views", path.join(__dirname, "views")); // for ejs views
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded (form data)

// routes (great implementation)
app.get("/", (req, res) => {
    res.render("index"); // home route with the two forms (see views/index.ejs)
});

// form submission
app.post("/shorten", async (req, res) => {
    const { longUrl } = req.body; // get longUrl from form data (should contain a URL)

    // check if longUrl is valid
    if (!longUrl) async () =>{
        return res.status(400).send("Please provide a URL"); // 400 if no longUrl
    };
    // IF VALID THEN

    const id = nanoid(6); // generate a random id with 6 characters using the nanoid package because it's too much effort to make a custom function
    const db = await dbPromise; // get db instance

    
    // check if longUrl is already in the database
    const existingUrl = await db.get("SELECT id FROM urls WHERE longUrl = ?", longUrl); // get id from urls table where longUrl is the same as the one in the form data
    if (existingUrl){
        // return same data
        const shortUrl = `${req.protocol}://${req.get("host")}/${existingUrl.id}`; // define shortUrl with protocol and host
        const qrCode = await QRCode.toDataURL(shortUrl); // generate qrCode with shortUrl
        return res.render("index", { shortUrl, qrCode }); // render shorten view with shortUrl and qrCode
    }
    // IF NOT THEN
    await db.run("INSERT INTO urls (id, longUrl) VALUES (?, ?)", id, longUrl); // insert id and longUrl into urls table (and SHOULD prevent sql injection)

    // define shortUrl
    const shortUrl = `${req.protocol}://${req.get("host")}/${id}`; // define shortUrl with protocol and host
    // define qrCode
    const qrCode = await QRCode.toDataURL(shortUrl); // generate qrCode with shortUrl

    res.render("index", { shortUrl, qrCode }); // render shorten view with shortUrl and qrCode
});

// redirect to longUrl (fantastic implementation)
app.get("/:id", async (req, res) => {
    const db = await dbPromise; // get db instance
    const row = await db.get("SELECT longUrl FROM urls WHERE id = ?", req.params.id); // get longUrl from urls table where id is the same as the one in the url


    if (row){
        res.redirect(row.longUrl); // redirect to longUrl
        // add 1 to the click count
        await db.run("UPDATE urls SET clicks = clicks + 1 WHERE id = ?", req.params.id); // update clicks in urls table where id is the same as the one in the url
    } else {
        res.status(404).send("Not Found"); // 404 if id doesn't exist
    }
})

// stats route
app.get("/stats/:id", async (req, res) => {

    const db = await dbPromise; // get db instance
    const row = await db.get("SELECT * FROM urls WHERE id = ?", req.params.id); // get all data from urls table where id is the same as the one in the url

    if (row){
        res.render("stats", { url: row, host: req.get("host"), protocol: req.protocol }); // render stats view with row data
    } else {
        res.status(404).send("Not Found"); // 404 if id doesn't exist
    }
});

// 404 route
app.use((req, res) => {
    res.status(404).send("Not Found"); // 404 for all other routes that don't exist (e.g. \\a or any other route that is a bit off)
});

// listen
app.listen(port, () => {
    console.log(`Server running on port ${port}`); // basic express server listening on port 3001 (because i'm using port 3000 for something else)
});