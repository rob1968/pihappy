import React, { useState } from "react";

function AddShopForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const shopData = { name, category, location, type };

    try {
      const response = await fetch("http://localhost:5000/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(shopData)
      });

      const data = await response.json();  // ✅ zorg dat je de response als JSON leest
      console.log("✅ Shop opgeslagen:", data); // dit moet het juiste shop object tonen

    } catch (error) {
      console.error("❌ Fout bij opslaan:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} />
      <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
      <input placeholder="Type" value={type} onChange={e => setType(e.target.value)} />
      <button type="submit">Save Shop</button>
    </form>
  );
}

export default AddShopForm;
