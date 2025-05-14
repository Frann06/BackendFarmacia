const mongoose = require('mongoose');

const FarmaciaSchema = new mongoose.Schema({
  uri: String,
  geo_long: Number,
  geo_lat: Number,
  schema_name: String,
  schema_telephone: String,
  schema_description: String,
  om_situadoEnVia: String,
  schema_fax: String,
  schema_address: String,
  schema_address_addressLocality: String,
  schema_address_postalCode: Number,
  Horario_de_manana_Opens: String,
  Horario_de_manana_Closes: String,
  Horario_de_tarde_invierno_Opens: String,
  Horario_de_tarde_invierno_Closes: String,
  Horario_de_tarde_verano_Opens: String,
  Horario_de_tarde_verano_Closes: String,
  Horario_Extendido_Opens: String,
  Horario_Extendido_Closes: String,
  Descripcion_Horario: String,
  tieneEnlaceSIG: String,

  // 👇 Campo geoespacial requerido
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitud, latitud]
      required: true
    }
  }
});

// 👇 Índice 2dsphere necesario para búsquedas geoespaciales
FarmaciaSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Farmacia', FarmaciaSchema);
