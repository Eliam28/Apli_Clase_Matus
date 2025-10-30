const express = require("express");
const app = express();
const mysql = require("mysql2/promise");
require("dotenv").config();

//Comit de prueba

const hostname = process.env.HOSTNAME;
const port = process.env.PORT;

app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

app.get("/", (req, res) => {
  res.send("Appi Conectada correctamente");
});

app.post("/api/products", (req, res) => {
  const { name, description, price, stock, image } = req.body;

  if (!name || !description || !price || !stock || !image) {
    return res.status(400).send("Falta información para agregar el producto");
  }

  const fecha = new Date();

  const sql =
    "INSERT	INTO products (name, description, price, stock, image, created_at) VALUES (?,?,?,?,?,?)";

  pool
    .query(sql, [name, description, price, stock, image, fecha])
    .then(([rows]) => {
      res.status(201).send("Producto agregado correctamente");
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error al insertar un producto");
    });
});

app.delete("/api/products/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM products WHERE id = ?";

  pool
    .query(sql, [id])
    .then(([rows]) => {
      if (rows.affectedRows === 0) {
        return res.status(404).send("No existe un producto con ese id");
      }
      res.status(200).send("Producto eliminado correctamente");
    })
    .catch((error) => {
      console.log(error);
      res.status(404).send("Error al eliminar un producto");
    });
});

app.put("/api/products/:id", (req, res) => {
  const id = req.params.id;
  const { name, description, price, stock, image } = req.body;

  if (!name && !description && !price && !stock && !image) {
    return res.status(400).send("No ingreso nungun cammbio");
  }

  let fields = [];
  let values = [];

  if (name) {
    fields.push("name = ?");
    values.push(name);
  }
  if (description) {
    fields.push("description  = ?");
    values.push(description);
  }
  if (price) {
    fields.push("price = ?");
    values.push(price);
  }
  if (stock) {
    fields.push("stock = ?");
    values.push(stock);
  }
  if (image) {
    fields.push("image = ?");
    values.push(image);
  }

  values.push(id);

  const sql = `UPDATE products SET ${fields.join(", ")} WHERE id = ?`;

  pool
    .query(sql, values)
    .then(([rows]) => {
      if (rows.affectedRows === 0) {
        return res.status(404).send("No hay producto con ese id");
      }
      res.status(200).send("El producto fue actualizado");
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Error al actualizar el producto");
    });
});

app.get("/api/products", (req, res) => {
  pool
    .query("select * from products")
    .then(([rows, fields]) => {
      res.json(rows);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Error al consultar usuarios");
    });
});

app.get("/api/products/:id", (req, res) => {
  const id = req.params.id;
  const sql = "select * from products where id =?";
  pool
    .query(sql, [id])
    .then(([rows, fields]) => {
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).send("Producto no encontrado");
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(404).send("Error al busacar el producto");
    });
});

app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
