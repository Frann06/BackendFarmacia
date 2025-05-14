const express = require('express');
const mongoose = require('mongoose');
const Farmacia = require('./models/Farmacia');
const app = express();
const datosRaw = require('./datos.json');
const morgan = require('morgan');
const cors = require('cors');

app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

const datosFarmacias = datosRaw.results.bindings.map((item) => ({
  uri: item.uri.value,
  geo_long: parseFloat(item.geo_long.value),
  geo_lat: parseFloat(item.geo_lat.value),
  schema_name: item.schema_name.value,
  schema_telephone: item.schema_telephone.value,
  schema_description: item.schema_description.value,
  om_situadoEnVia: item.om_situadoEnVia.value,
  schema_fax: item.schema_fax.value,
  schema_address: item.schema_address.value,
  schema_address_addressLocality: item.schema_address_addressLocality.value,
  schema_address_postalCode: parseInt(item.schema_address_postalCode.value),
  Horario_de_manana_Opens: item.Horario_de_manana_Opens.value,
  Horario_de_manana_Closes: item.Horario_de_manana_Closes.value,
  Horario_de_tarde_invierno_Opens: item.Horario_de_tarde_invierno_Opens.value,
  Horario_de_tarde_invierno_Closes: item.Horario_de_tarde_invierno_Closes.value,
  Horario_de_tarde_verano_Opens: item.Horario_de_tarde_verano_Opens.value,
  Horario_de_tarde_verano_Closes: item.Horario_de_tarde_verano_Closes.value,
  Horario_Extendido_Opens: item.Horario_Extendido_Opens.value,
  Horario_Extendido_Closes: item.Horario_Extendido_Closes.value,
  Descripcion_Horario: item.Descripcion_Horario.value,
  tieneEnlaceSIG: item.tieneEnlaceSIG.value,
  location: {
    type: "Point",
    coordinates: [parseFloat(item.geo_long.value), parseFloat(item.geo_lat.value)]
  }
}));


// Conexión a MongoDB
mongoose.connect('mongodb://localhost:27017/farmaciasdb')
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error de conexión', err));

// Ruta para importar las farmacias
app.post('/importar', async (req, res) => {
  try {
    await Farmacia.insertMany(datosFarmacias);
    res.send('Farmacias importadas correctamente');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al importar farmacias');
  }
});

// Ruta para ver todas las farmacias
app.get('/farmacias', async (req, res) => {
  try {
    const farmacias = await Farmacia.find();
    res.json(farmacias);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener farmacias');
  }
});


// Función para calcular distancia entre dos puntos geográficos (fórmula de Haversine)
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distancia = R * c;
  return distancia; // en km
}

// Ruta para encontrar la farmacia más cercana
app.get('/farmacia-mas-cercana', async (req, res) => {
  res.set('Cache-Control', 'no-store'); // Esto evita que los datos se almacenen en caché
  const { lat, long } = req.query;

  if (!lat || !long) {
    return res.status(400).send('Faltan coordenadas');
  }

  try {
    const farmacia = await Farmacia.findOne({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(long), parseFloat(lat)]
          }
        }
      }
    });

    if (!farmacia) {
      return res.status(404).send('No se encontró farmacia cercana');
    }

    res.json(farmacia);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar farmacia más cercana');
  }
});



app.get('/farmacias-cercanas/top3', async (req, res) => {
  res.set('Cache-Control', 'no-store'); // Esto evita que los datos se almacenen en caché
  const { lat, long } = req.query;

  if (!lat || !long) {
    return res.status(400).send('Faltan coordenadas');
  }

  try {
    const farmacias = await Farmacia.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(long), parseFloat(lat)]
          }
        }
      }
    }).limit(3);

    res.json(farmacias);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar farmacias cercanas');
  }
});



// Nueva ruta para obtener farmacias dentro de un radio
app.get('/farmacias-en-radio', async (req, res) => {
  res.set('Cache-Control', 'no-store'); // Esto evita que los datos se almacenen en caché
  const { lat, long, radio } = req.query;

  if (!lat || !long || !radio) {
    return res.status(400).send('Faltan parámetros');
  }

  try {
    const farmacias = await Farmacia.find({
      location: {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(long), parseFloat(lat)],
            parseFloat(radio) / 6371 // radio en km dividido entre el radio de la Tierra
          ]
        }
      }
    });

    res.json(farmacias);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar farmacias en el radio');
  }
});

app.delete('/borrar-todo', async (req, res) => {
  try {
    await Farmacia.deleteMany({});
    res.send('Todas las farmacias eliminadas');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al borrar farmacias');
  }
});


// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
