const key = process.env.GEMINI_API_KEY;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
const data = await res.json();
const models = data.models || [];
const imageModels = models.filter(m => /image|imagen/i.test(m.name));
if (imageModels.length === 0) {
  console.log("No image models found. Showing all models:");
  models.forEach(m => console.log(m.name));
} else {
  imageModels.forEach(m => console.log(m.name, "->", m.supportedGenerationMethods));
}
