const apiKey = "095624539824482ba247c430eec14017";
const personaId = "p253a93627a5";

fetch("https://tavusapi.com/v2/conversations", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({
    persona_id: personaId,
    conversation_name: "Diagnostic Test",
  }),
})
  .then((res) => res.json())
  .then((data) => {
    console.log("Raw Response:", JSON.stringify(data, null, 2));
  })
  .catch((err) => console.error("Fetch Error:", err));
