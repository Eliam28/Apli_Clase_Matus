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
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
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

// Proyecto segundo parcial

app.post("/api/purchases", async (req, res) => {
  const { user_id, status, details } = req.body;

  if (
    !user_id ||
    !status ||
    !details ||
    !Array.isArray(details) ||
    details.length === 0
  ) {
    return res
      .status(400)
      .send("Todos los campos son obligatorios y minimo un producto");
  }

  if (details.length > 5) {
    return res.status(400).send("No se puede agregar mas de 5 productos");
  }

  const conexion = await pool.getConnection();
  await conexion.beginTransaction();

  try {
    let totalcompra = 0;

    for (const item of details) {
      if (!item.product_id || !item.quantity || !item.price) {
        throw new Error("Ingrese todos los campos en el detalle del producto");
      }

      const [productRows] = await conexion.query(
        "SELECT stock FROM products WHERE id = ?",
        [item.product_id]
      );
      if (productRows.length === 0) {
        throw new Error(`El producto ${item.product_id} no existe`);
      }

      const stock = productRows[0].stock;
      if (stock < item.quantity) {
        throw new Error(
          `No hay suficiente stock para el producto ${item.product_id}.`
        );
      }

      totalcompra += item.quantity * item.price;
    }

    if (totalcompra > 3500) {
      throw new Error("El total de la compra no puede ser mayor a 3500");
    }

    const fechaCompra = new Date();
    const [purchaseResult] = await conexion.query(
      "INSERT INTO purchases (user_id, total, status, purchase_date) VALUES (?, ?, ?, ?)",
      [user_id, totalcompra, status, fechaCompra]
    );

    const purchaseId = purchaseResult.insertId;

    for (const item of details) {
      const subtotalCompra = item.quantity * item.price;
      await conexion.query(
        "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)",
        [purchaseId, item.product_id, item.quantity, item.price, subtotalCompra]
      );

      await conexion.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    await conexion.commit();
    res.status(201).send("Compra registrada correctamente :)");
  } catch (error) {
    await conexion.rollback();
    console.error(error);
    res.status(400).send(`Error al registrar la compra :c ${error.message}`);
  } finally {
    conexion.release();
  }
});

app.put("/api/purchases/:id", async (req, res) => {
  const idCompra = req.params.id;
  const { user_id, status, details } = req.body;

  const conexion = await pool.getConnection();
  await conexion.beginTransaction();

  try {
    const [purchaseRows] = await conexion.query(
      "SELECT * FROM purchases WHERE id = ?",
      [idCompra]
    );

    if (purchaseRows.length === 0) {
      throw new Error("La compra no existe");
    }

    const compraActual = purchaseRows[0];

    if (compraActual.status === "COMPLETED") {
      throw new Error("No se puede modificar una compra en estado COMPLETED");
    }

    const [oldDetails] = await conexion.query(
      "SELECT product_id, quantity, price, subtotal FROM purchase_details WHERE purchase_id = ?",
      [idCompra]
    );

    const detailsMap = {};
    for (const item of oldDetails) {
      detailsMap[item.product_id] = item;
    }

    if (details && Array.isArray(details) && details.length > 0) {
      const productosExistentes = oldDetails.map((d) => d.product_id);
      const nuevosIds = details.map((d) => d.product_id);

      const conjuntoFinal = new Set([...productosExistentes, ...nuevosIds]);
      if (conjuntoFinal.size > 5) {
        throw new Error("No se pueden tener más de 5 productos en la compra");
      }

      for (const item of details) {
        if (!item.product_id || !item.quantity || !item.price) {
          throw new Error(
            "Ingrese todos los campos en el detalle del producto"
          );
        }

        const [productRows] = await conexion.query(
          "SELECT stock FROM products WHERE id = ?",
          [item.product_id]
        );

        if (productRows.length === 0) {
          throw new Error(`El producto ${item.product_id} no existe`);
        }

        const stock = productRows[0].stock;
        const subtotal = item.quantity * item.price;

        if (detailsMap[item.product_id]) {
          const oldQuantity = detailsMap[item.product_id].quantity;
          const diferencia = item.quantity - oldQuantity;

          if (diferencia > 0) {
            if (stock < diferencia) {
              throw new Error(
                `No hay suficiente stock para el producto ${item.product_id}.`
              );
            }
            await conexion.query(
              "UPDATE products SET stock = stock - ? WHERE id = ?",
              [diferencia, item.product_id]
            );
          }

          if (diferencia < 0) {
            await conexion.query(
              "UPDATE products SET stock = stock + ? WHERE id = ?",
              [Math.abs(diferencia), item.product_id]
            );
          }

          await conexion.query(
            "UPDATE purchase_details SET quantity = ?, price = ?, subtotal = ? WHERE purchase_id = ? AND product_id = ?",
            [item.quantity, item.price, subtotal, idCompra, item.product_id]
          );
        } else {
          if (stock < item.quantity) {
            throw new Error(
              `No hay suficiente stock para el producto ${item.product_id}.`
            );
          }
          await conexion.query(
            "INSERT INTO purchase_details (purchase_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)",
            [idCompra, item.product_id, item.quantity, item.price, subtotal]
          );

          await conexion.query(
            "UPDATE products SET stock = stock - ? WHERE id = ?",
            [item.quantity, item.product_id]
          );
        }
      }
    }
    const [newDetails] = await conexion.query(
      "SELECT subtotal FROM purchase_details WHERE purchase_id = ?",
      [idCompra]
    );

    const totalCompra = newDetails.reduce(
      (acc, item) => acc + Number(item.subtotal),
      0
    );

    if (totalCompra > 3500) {
      throw new Error("El total de la compra no puede ser mayor a 3500");
    }
    const fechaNueva = new Date();

    await conexion.query(
      `
      UPDATE purchases 
      SET user_id = COALESCE(?, user_id),
          status = COALESCE(?, status),
          total = ?,
          purchase_date = ?
      WHERE id = ?
      `,
      [
        user_id || compraActual.user_id,
        status || compraActual.status,
        totalCompra,
        fechaNueva,
        idCompra,
      ]
    );

    await conexion.commit();
    res.status(200).send("Compra actualizada de forma correcta");
  } catch (error) {
    await conexion.rollback();
    console.error(error.message);
    res.status(400).send(`Error al actualizar la compra :c ${error.message}`);
  } finally {
    conexion.release();
  }
});

app.delete("/api/purchases/:id", async (req, res) => {
  const idCompra = req.params.id;
  const conexion = await pool.getConnection();
  await conexion.beginTransaction();

  try {
    const [purchaseRows] = await conexion.query(
      "SELECT * FROM purchases WHERE id = ?",
      [idCompra]
    );

    if (purchaseRows.length === 0) {
      throw new Error("La compra no existe");
    }

    const compraActual = purchaseRows[0];

    if (compraActual.status === "COMPLETED") {
      throw new Error("No se puede eliminar una compra en estado COMPLETED");
    }

    const [detailsRows] = await conexion.query(
      "SELECT product_id, quantity FROM purchase_details WHERE purchase_id = ?",
      [idCompra]
    );

    for (const item of detailsRows) {
      await conexion.query(
        "UPDATE products SET stock = stock + ? WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }

    await conexion.query("DELETE FROM purchase_details WHERE purchase_id = ?", [
      idCompra,
    ]);

    await conexion.query("DELETE FROM purchases WHERE id = ?", [idCompra]);
    await conexion.commit();
    res.status(200).send("Compra eliminada de forma correcta");
  } catch (error) {
    await conexion.rollback();
    console.error(error.message);
    res.status(400).send(`Error al eliminar la compra :c ${error.message}`);
  } finally {
    conexion.release();
  }
});

app.get("/api/purchases", async (req, res) => {
  const conexion = await pool.getConnection();

  try {
    const [rows] = await conexion.query(`
      SELECT 
        p.id AS purchase_id,
        u.name AS user,
        p.total,
        p.status,
        p.purchase_date,
        d.id AS detail_id,
        pr.name AS product,
        d.quantity,
        d.price,
        d.subtotal
      FROM purchases p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN purchase_details d ON p.id = d.purchase_id
      INNER JOIN products pr ON d.product_id = pr.id
      ORDER BY p.id, d.id
    `);

    const purchasesMap = {};

    for (const row of rows) {
      if (!purchasesMap[row.purchase_id]) {
        purchasesMap[row.purchase_id] = {
          id: row.purchase_id,
          user: row.user,
          total: row.total,
          status: row.status,
          purchase_date: row.purchase_date,
          details: [],
        };
      }

      purchasesMap[row.purchase_id].details.push({
        id: row.detail_id,
        product: row.product,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
      });
    }

    const result = Object.values(purchasesMap);
    res.status(200).json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).send(`Error al obtener las compras: ${error.message}`);
  } finally {
    conexion.release();
  }
});

app.get("/api/purchases/:id", async (req, res) => {
  const idCompra = req.params.id;
  const conexion = await pool.getConnection();

  try {
    const [rows] = await conexion.query(
      `
      SELECT 
        p.id AS purchase_id,
        u.name AS user,
        p.total,
        p.status,
        p.purchase_date,
        d.id AS detail_id,
        pr.name AS product,
        d.quantity,
        d.price,
        d.subtotal
      FROM purchases p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN purchase_details d ON p.id = d.purchase_id
      INNER JOIN products pr ON d.product_id = pr.id
      WHERE p.id = ?
      ORDER BY d.id
      `,
      [idCompra]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No existe la compra con ese ID" });
    }

    const compra = {
      id: rows[0].purchase_id,
      user: rows[0].user,
      total: rows[0].total,
      status: rows[0].status,
      purchase_date: rows[0].purchase_date,
      details: rows.map((row) => ({
        id: row.detail_id,
        product: row.product,
        quantity: row.quantity,
        price: row.price,
        subtotal: row.subtotal,
      })),
    };

    res.status(200).json(compra);
  } catch (error) {
    console.error(error.message);
    res.status(500).send(`Hubo un problema con:  ${error.message}`);
  } finally {
    conexion.release();
  }
});
