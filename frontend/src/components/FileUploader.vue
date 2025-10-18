<script setup>
import { ref, computed } from 'vue';
import Tesseract from 'tesseract.js';

// --- VARIABLES Y DATOS (sin cambios) ---
const extractedAddresses = ref([]);
const isProcessing = ref(false);
const backendResponse = ref(null);
const warehouses = [
  { code: 'VFL8', address: '9775 air commerce parkway Orlando, FL' },
  { code: 'VFL1', address: '7469 Kingspointe Pkwy Orlando, FL' },
  { code: 'DMO3', address: '1216 S Orange Blossom Trl Orlando, FL' },
  { code: 'DFL4', address: '4401 Seaboard Rd Orlando, FL' },
  { code: 'DFL8', address: '7453 Republic Dr Groveland, FL' },
  { code: 'DMO4', address: '2400 Mason Ave Daytona Beach, FL' },
];
const destinations = ref([
  { code: 'Casa', address: '513 Alafaya Woods Blvd Oviedo, FL' },
  ...warehouses,
  { code: 'Otro (especificar abajo)', address: 'custom' }
]);
const selectedWarehouse = ref(warehouses[0].address);
const selectedDestination = ref(destinations.value[0].address);
const customDestination = ref('');

// --- PROPIEDADES COMPUTADAS (sin cambios) ---
const reportData = computed(() => { /* ... sin cambios ... */ });
const scenarioETAs = computed(() => { /* ... sin cambios ... */ });

// --- FUNCIONES PARA EDITAR LA LISTA (sin cambios) ---
function removeAddress(index) { extractedAddresses.value.splice(index, 1); }
function addAddress() { extractedAddresses.value.push({ number: null, address: '', isDowntown: false }); }
function reorderList() { extractedAddresses.value.sort((a, b) => a.number - b.number); }

// --- FUNCIONES DE PROCESAMIENTO ---
function preprocessImage(file) { /* ... sin cambios ... */ }
function parseAddresses(rawText) { /* ... sin cambios ... */ }

// --- handleFileChange CON LOGGING ---
async function handleFileChange(event) {
  console.log("handleFileChange triggered!"); // Log 1
  const files = event.target.files;
  if (!files || files.length === 0) {
      console.log("No files selected."); // Log 2
      return;
  }
  console.log(`Files selected: ${files.length}`); // Log 3

  try {
      isProcessing.value = true;
      console.log("isProcessing set to true"); // Log 4
      extractedAddresses.value = [];
      backendResponse.value = null;
      let allParsedStops = [];

      console.log("Starting file processing loop..."); // Log 5
      for (const [index, file] of Array.from(files).entries()) {
          console.log(`Processing file ${index + 1}/${files.length}: ${file.name}`); // Log 6
          const processedImage = await preprocessImage(file);
          console.log(`File ${index + 1} preprocessed.`); // Log 7
          const { data: { text } } = await Tesseract.recognize(processedImage, 'eng');
          console.log(`File ${index + 1} OCR complete.`); // Log 8
          const stopsFromFile = parseAddresses(text);
          allParsedStops.push(...stopsFromFile);
          console.log(`File ${index + 1} parsed.`); // Log 9
      }
      console.log("File processing loop finished."); // Log 10

      // Lógica de Gaps (sin cambios)
      const uniqueStopsMap = new Map(allParsedStops.map(stop => [stop.number, stop]));
      let maxStopNumber = 0;
      uniqueStopsMap.forEach(stop => {
          if (stop.number > maxStopNumber) maxStopNumber = stop.number;
      });
      const fullListWithGaps = [];
      for (let i = 1; i <= maxStopNumber; i++) {
          if (uniqueStopsMap.has(i)) {
              fullListWithGaps.push(uniqueStopsMap.get(i));
          } else {
              fullListWithGaps.push({ number: i, address: '', isDowntown: false });
          }
      }
      console.log("Gap filling complete."); // Log 11

      extractedAddresses.value = fullListWithGaps;
      console.log("extractedAddresses updated."); // Log 12

  } catch (error) {
      console.error("Error during handleFileChange:", error); // Log de Error
      // Asegurarse de que isProcessing se apague incluso si hay error
  } finally {
      isProcessing.value = false;
      console.log("isProcessing set to false."); // Log 13
  }
}


function sanitizeAddress(address) { /* ... sin cambios ... */ }
async function sendToBackend() { /* ... sin cambios ... */ }
</script>

<template>
    <div class="uploader-container">
        </div>
</template>

<style scoped>
    /* Los estilos no necesitan ningún cambio */
    .uploader-container { /* ... */ }
    /* ... (resto de los estilos sin cambios) ... */
</style>