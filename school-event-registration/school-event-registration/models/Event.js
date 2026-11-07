const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  date:        { type: Date, required: true },
  venue:       { type: String, required: true },
  description: { type: String, default: '' },
  status:      { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
