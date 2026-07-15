import { useState } from "react";

const initialForm = {
  productUrl: "",
  productName: "",
  brandName: "",
  price: "",
  targetCountry: "United States",
  brandTone: "Professional",
  campaignGoal: "Sales",
  productDescription: "",
};

export default function NewCampaign() {
  const [form, setForm] = useState(initialForm);
  const [productImage, setProductImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid product image.");
      return;
    }

    setError("");
    setProductImage(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.productName.trim()) {
      setError("Product name is required.");
      return;
    }

    if (!form.brandName.trim()) {
      setError("Brand name is required.");
      return;
    }

    if (!form.productUrl.trim() && !productImage) {
      setError("Add a product URL or upload a product image.");
      return;
    }

    try {
      setIsGenerating(true);

      // We will connect this form to the Flask backend next.
      console.log({
        ...form,
        productImage,
      });

      alert("Campaign form is working. Backend connection is next.");
    } catch (submitError) {
      console.error(submitError);
      setError("Campaign generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-400">
            Droxion DTC Campaign Engine
          </p>

          <h1 className="text-3xl font-bold sm:text-4xl">
            Create a new marketing campaign
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Add your product information and Droxion will generate positioning,
            customer research, ad angles, social content, emails and creative
            concepts.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Product name" required>
              <input
                type="text"
                name="productName"
                value={form.productName}
                onChange={handleChange}
                placeholder="Example: Hydrating Face Serum"
                className="input-style"
              />
            </Field>

            <Field label="Brand name" required>
              <input
                type="text"
                name="brandName"
                value={form.brandName}
                onChange={handleChange}
                placeholder="Example: GlowSkin"
                className="input-style"
              />
            </Field>

            <Field label="Product URL">
              <input
                type="url"
                name="productUrl"
                value={form.productUrl}
                onChange={handleChange}
                placeholder="https://yourstore.com/product"
                className="input-style"
              />
            </Field>

            <Field label="Product price">
              <input
                type="text"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="$39.99"
                className="input-style"
              />
            </Field>

            <Field label="Target country">
              <select
                name="targetCountry"
                value={form.targetCountry}
                onChange={handleChange}
                className="input-style"
              >
                <option>United States</option>
                <option>Canada</option>
                <option>United Kingdom</option>
                <option>India</option>
                <option>Australia</option>
                <option>Worldwide</option>
              </select>
            </Field>

            <Field label="Campaign goal">
              <select
                name="campaignGoal"
                value={form.campaignGoal}
                onChange={handleChange}
                className="input-style"
              >
                <option>Sales</option>
                <option>Product Launch</option>
                <option>Brand Awareness</option>
                <option>Retargeting</option>
                <option>Lead Generation</option>
              </select>
            </Field>

            <Field label="Brand tone">
              <select
                name="brandTone"
                value={form.brandTone}
                onChange={handleChange}
                className="input-style"
              >
                <option>Professional</option>
                <option>Bold</option>
                <option>Luxury</option>
                <option>Friendly</option>
                <option>Playful</option>
                <option>Minimal</option>
                <option>Urgent</option>
              </select>
            </Field>

            <Field label="Product image">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-500"
              />

              {productImage && (
                <p className="mt-2 text-sm text-emerald-400">
                  Selected: {productImage.name}
                </p>
              )}
            </Field>
          </div>

          <div className="mt-6">
            <Field label="Product description">
              <textarea
                name="productDescription"
                value={form.productDescription}
                onChange={handleChange}
                rows="5"
                placeholder="Explain what the product does, its benefits and what makes it different."
                className="input-style resize-none"
              />
            </Field>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating
              ? "Generating campaign..."
              : "Generate Complete Campaign"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Droxion will create research, strategy, ad copy, social posts,
            emails and creative concepts.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>

      {children}
    </label>
  );
}
