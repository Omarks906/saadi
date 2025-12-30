// Quick test script to see what Replicate returns
const fs = require('fs');
const Replicate = require('replicate');

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
const tokenMatch = envContent.match(/REPLICATE_API_TOKEN=(.+)/);
const token = tokenMatch ? tokenMatch[1].trim() : null;

const replicate = new Replicate({
  auth: token,
});

const MODEL = 'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003';
const imageUrl = 'https://nonantagonistic-areolar-albert.ngrok-free.dev/uploads/70e47271339cb5ae/original/1767079581656-1767006746841-Screenshot_2025-12-29_at_11.55.07.png';

console.log('Testing Replicate SDK...');
console.log('Model:', MODEL);
console.log('Image URL:', imageUrl);
console.log('Token present:', !!token);
console.log('Token length:', token?.length || 0);
console.log('');

// Try using createPrediction and wait for it manually
console.log('\n=== Method 1: Using replicate.run() ===');
replicate.run(MODEL, { input: { image: imageUrl } })
  .then(output => {
    console.log('SUCCESS!');
    console.log('Output type:', typeof output);
    console.log('Output is null:', output === null);
    console.log('Output is undefined:', output === undefined);
    console.log('Output keys:', output && typeof output === 'object' ? Object.keys(output) : 'N/A');
    console.log('Output:', JSON.stringify(output, null, 2));
  })
  .catch(err => {
    console.error('ERROR!');
    console.error('Error message:', err.message);
    console.error('Error type:', err.constructor.name);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    console.error('Full error:', err);
  });

// Also try createPrediction directly
setTimeout(() => {
  console.log('\n=== Method 2: Using createPrediction() ===');
  replicate.predictions.create({
    model: MODEL,
    input: { image: imageUrl },
  })
    .then(prediction => {
      console.log('Prediction created:', prediction.id);
      console.log('Status:', prediction.status);
      console.log('Output:', prediction.output);
      console.log('Full prediction:', JSON.stringify(prediction, null, 2));
    })
    .catch(err => {
      console.error('ERROR creating prediction!');
      console.error('Error message:', err.message);
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
    });
}, 2000);

