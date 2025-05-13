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

// Adaptamos los datos a un formato fácil para MongoDB
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
  tieneEnlaceSIG: item.tieneEnlaceSIG.value
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
  const { lat, long } = req.query; // 🔥 Aquí usamos .query en vez de .body

  if (lat === undefined || long === undefined) {
      return res.status(400).send('Faltan las coordenadas');
  }

  try {
      const farmacias = await Farmacia.find();

      if (!farmacias.length) {
          return res.status(404).send('No hay farmacias disponibles');
      }

      let farmaciaCercana = farmacias[0];
      let distanciaMinima = calcularDistancia(lat, long, farmaciaCercana.geo_lat, farmaciaCercana.geo_long);

      for (let i = 1; i < farmacias.length; i++) {
          const farmacia = farmacias[i];
          const distancia = calcularDistancia(lat, long, farmacia.geo_lat, farmacia.geo_long);

          if (distancia < distanciaMinima) {
              distanciaMinima = distancia;
              farmaciaCercana = farmacia;
          }
      }

      res.json({
          farmacia: farmaciaCercana,
          distancia_km: distanciaMinima.toFixed(2)
      });
      
  } catch (error) {
      console.error(error);
      res.status(500).send('Error buscando la farmacia más cercana');
  }
});


app.get('/farmacias-cercanas/top3', async (req, res) => {
  const { lat, long } = req.query;

  if (!lat || !long) {
    return res.status(400).send('Se requieren latitud y longitud');
  }

  try {
    const farmacias = await Farmacia.find();
    
    // Calculamos distancia para cada farmacia y añadimos el campo temporal
    const farmaciasConDistancia = farmacias.map(farmacia => {
      const distancia = calcularDistancia(
        parseFloat(lat),
        parseFloat(long),
        farmacia.geo_lat,
        farmacia.geo_long
      );
      return {
        ...farmacia._doc,
        distancia: distancia
      };
    });

    // Ordenamos por distancia y tomamos las 3 primeras
    const farmaciasOrdenadas = farmaciasConDistancia
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, 3);

    res.json(farmaciasOrdenadas);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar farmacias cercanas');
  }
});


// Nueva ruta para obtener farmacias dentro de un radio
app.get('/farmacias-en-radio', async (req, res) => {
  const { lat, long, radio } = req.query;

  if (!lat || !long || !radio) {
    return res.status(400).send('Se requieren latitud, longitud y radio');
  }

  const latitud = parseFloat(lat);
  const longitud = parseFloat(long);
  const radioKm = parseFloat(radio);
  console.log(latitud, longitud, radioKm);

  if (isNaN(latitud) || isNaN(longitud) || isNaN(radioKm)) {
    return res.status(400).send('Los parámetros de latitud, longitud y radio deben ser números');
  }

  try {
    const todasLasFarmacias = await Farmacia.find();
    const farmaciasCercanas = todasLasFarmacias.filter(farmacia => {
      const distancia = calcularDistancia(
        latitud,
        longitud,
        farmacia.geo_lat,
        farmacia.geo_long
      );
      return distancia <= radioKm;
    });

    res.json(farmaciasCercanas);

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al buscar farmacias dentro del radio');
  }
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
