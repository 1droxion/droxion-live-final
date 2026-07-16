import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

const initialForm = {
  productName: "",
  brandName: "",
  productUrl: "",
  price: "",
  currency: "USD",
  targetCountry: "United States",
  campaignGoal: "Increase Sales",
  brandTone: "Professional",
  targetCustomer: "",
  productDescription: "",
  keyBenefits: "",
  specialOffer: "",
};

const campaignOutputs = [
  "Product positioning",
  "Target-customer profile",
  "Marketing strategy",
  "Ad angles and hooks",
  "Social-media content",
  "Email campaign",
  "Video and UGC scripts",
  "Creative image concepts",
];

export default function NewCampaign() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!productImage) {
      setImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(productImage);
    setImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [productImage]);

  const completionPercentage = useMemo(() => {
    const importantFields = [
      form.productName,
      form.brandName,
      form.productDescription,
      form.targetCustomer,
      form.keyBenefits,
    ];

    if (form.productUrl || productImage) {
      importantFields.push("product-source-added");
    }

    const completed = importantFields.filter(
      (value) => String(value).trim().length > 0
    ).length;

    return Math.round((completed / 6) * 100);
  }, [form, productImage]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setError("");
    setSuccessMessage("");
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, WEBP or GIF image.");
      event.target.value = "";
      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
      setError("The product image must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setProductImage(file);
    setError("");
    setSuccessMessage("");
  };

  const removeImage = () => {
    setProductImage(null);
    setImagePreview("");
  };

  const validateForm = () => {
    if (!form.productName.trim()) {
      return "Enter the product name.";
    }

    if (!form.brandName.trim()) {
      return "Enter the brand name.";
    }

    if (!form.productUrl.trim() && !productImage) {
      return "Add a product URL or upload a product image.";
    }

    if (
      form.productUrl.trim() &&
      !form.productUrl.trim().startsWith("http://") &&
      !form.productUrl.trim().startsWith("https://")
    ) {
      return "Enter a complete product URL beginning with http:// or https://.";
    }

    if (!form.productDescription.trim()) {
      return "Enter a product description.";
    }

    if (!form.targetCustomer.trim()) {
      return "Describe the target customer.";
    }

    if (!form.keyBenefits.trim()) {
      return "Enter at least one key product benefit.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccessMessage("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return;
    }

    try {
      setIsGenerating(true);
      setError("");
      setSuccessMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Your login session expired. Please log in again.");
      }

      const backendUrl =
        import.meta.env.VITE_BACKEND_URL ||
        "https://droxion-backend.onrender.com";

      const response = await fetch(
        `${backendUrl}/generate-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productName: form.productName.trim(),
            brandName: form.brandName.trim(),
            productUrl: form.productUrl.trim(),
            price: form.price.trim(),
            currency: form.currency,
            targetCountry: form.targetCountry,
            campaignGoal: form.campaignGoal,
            brandTone: form.brandTone,
            targetCustomer: form.targetCustomer.trim(),
            productDescription: form.productDescription.trim(),
            keyBenefits: form.keyBenefits.trim(),
            specialOffer: form.specialOffer.trim(),
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.detail ||
            result?.error ||
            `Campaign generation failed with status ${response.status}.`
        );
      }

      if (!result.campaign) {
        throw new Error("The backend returned no campaign.");
      }

      const campaignRecord = {
        user_id: user.id,
        product_name: form.productName.trim(),
        brand_name: form.brandName.trim(),
        product_url: form.productUrl.trim() || null,
        price: form.price.trim() || null,
        currency: form.currency,
        target_country: form.targetCountry,
        campaign_goal: form.campaignGoal,
        brand_tone: form.brandTone,
        target_customer: form.targetCustomer.trim(),
        product_description: form.productDescription.trim(),
        key_benefits: form.keyBenefits.trim(),
        special_offer: form.specialOffer.trim() || null,
        campaign_data: result.campaign,
      };

      const {
        data: savedCampaign,
        error: saveError,
      } = await supabase
        .from("campaigns")
        .insert(campaignRecord)
        .select()
        .single();

      if (saveError) {
        throw new Error(
          `Campaign was generated, but saving failed: ${saveError.message}`
        );
      }

      localStorage.setItem(
        "droxion_latest_campaign",
        JSON.stringify({
          id: savedCampaign.id,
          campaign: result.campaign,
          form,
          createdAt: savedCampaign.created_at,
        })
      );

      setSuccessMessage(
        "Your AI marketing campaign was generated and saved."
      );

      navigate("/campaign-results", {
        state: {
          campaignId: savedCampaign.id,
        },
      });
    } catch (requestError) {
      console.error(
        "Campaign generation error:",
        requestError
      );

      setError(
        requestError?.message ||
          "Campaign generation failed. Please try again."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setProductImage(null);
    setImagePreview("");
    setError("");
    setSuccessMessage("");
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="border-b border-white/10 bg-[#0e0e10]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-bold tracking-tight">Droxion</p>
            <p className="text-xs text-gray-500">
              DTC Campaign Intelligence
            </p>
          </div>

          <a
            href="/projects"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
          >
            My campaigns
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-3 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            New DTC campaign
          </div>

          <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Turn one product into a complete marketing campaign
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
            Give Droxion your product information. It will build the
            positioning, strategy, advertising angles, social content, email
            copy and creative concepts.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <strong className="font-semibold">Fix this:</strong> {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {successMessage}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-white/10 bg-[#111216] shadow-2xl"
          >
            <FormSection
              number="1"
              title="Product information"
              description="Tell Droxion exactly what you are selling."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Product name" required>
                  <input
                    type="text"
                    name="productName"
                    value={form.productName}
                    onChange={handleChange}
                    placeholder="Example: Daily Hydration Serum"
                    className="input-style"
                  />
                </FormField>

                <FormField label="Brand name" required>
                  <input
                    type="text"
                    name="brandName"
                    value={form.brandName}
                    onChange={handleChange}
                    placeholder="Example: Vela Skin"
                    className="input-style"
                  />
                </FormField>

                <FormField
                  label="Product URL"
                  helper="You can use a Shopify or product-page link."
                >
                  <input
                    type="url"
                    name="productUrl"
                    value={form.productUrl}
                    onChange={handleChange}
                    placeholder="https://yourstore.com/products/..."
                    className="input-style"
                  />
                </FormField>

                <FormField label="Product price">
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <select
                      name="currency"
                      value={form.currency}
                      onChange={handleChange}
                      className="input-style"
                    >
                      <option value="USD">USD</option>
                      <option value="CAD">CAD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="INR">INR</option>
                      <option value="AUD">AUD</option>
                    </select>

                    <input
                      type="text"
                      inputMode="decimal"
                      name="price"
                      value={form.price}
                      onChange={handleChange}
                      placeholder="39.99"
                      className="input-style"
                    />
                  </div>
                </FormField>
              </div>

              <div className="mt-5">
                <FormField
                  label="Product image"
                  helper="Upload one clear product image. Maximum size: 10 MB."
                >
                  {!imagePreview ? (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-[#090a0d] px-6 py-10 text-center transition hover:border-blue-500 hover:bg-blue-500/5">
                      <span className="text-3xl">📦</span>
                      <span className="mt-3 text-sm font-semibold text-white">
                        Upload product image
                      </span>
                      <span className="mt-1 text-xs text-gray-500">
                        JPG, PNG, WEBP or GIF
                      </span>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#090a0d] p-4 sm:flex-row sm:items-center">
                      <img
                        src={imagePreview}
                        alt="Selected product preview"
                        className="h-28 w-28 rounded-xl border border-white/10 object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {productImage?.name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {productImage
                            ? `${(productImage.size / 1024 / 1024).toFixed(
                                2
                              )} MB`
                            : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={removeImage}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </FormField>
              </div>
            </FormSection>

            <FormSection
              number="2"
              title="Campaign direction"
              description="Choose the market, objective and communication style."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField label="Target country">
                  <select
                    name="targetCountry"
                    value={form.targetCountry}
                    onChange={handleChange}
                    className="input-style"
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Australia</option>
                    <option>India</option>
                    <option>Worldwide</option>
                  </select>
                </FormField>

                <FormField label="Campaign goal">
                  <select
                    name="campaignGoal"
                    value={form.campaignGoal}
                    onChange={handleChange}
                    className="input-style"
                  >
                    <option>Increase Sales</option>
                    <option>Launch Product</option>
                    <option>Build Awareness</option>
                    <option>Acquire Customers</option>
                    <option>Retarget Visitors</option>
                    <option>Collect Leads</option>
                  </select>
                </FormField>

                <FormField label="Brand tone">
                  <select
                    name="brandTone"
                    value={form.brandTone}
                    onChange={handleChange}
                    className="input-style"
                  >
                    <option>Professional</option>
                    <option>Friendly</option>
                    <option>Bold</option>
                    <option>Luxury</option>
                    <option>Playful</option>
                    <option>Minimal</option>
                    <option>Educational</option>
                    <option>Urgent</option>
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection
              number="3"
              title="Customer and product details"
              description="More context gives Droxion stronger and more specific campaign output."
            >
              <div className="space-y-5">
                <FormField
                  label="Product description"
                  required
                  helper="Explain what the product is, how it works and why it is different."
                >
                  <textarea
                    name="productDescription"
                    value={form.productDescription}
                    onChange={handleChange}
                    rows="5"
                    placeholder="Describe your product, ingredients or materials, use case and unique qualities."
                    className="input-style resize-y"
                  />
                </FormField>

                <FormField
                  label="Target customer"
                  required
                  helper="Describe the person most likely to buy this product."
                >
                  <textarea
                    name="targetCustomer"
                    value={form.targetCustomer}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Example: Women aged 25–45 who want a simple skincare routine and frequently shop online."
                    className="input-style resize-y"
                  />
                </FormField>

                <FormField
                  label="Key benefits"
                  required
                  helper="Separate multiple benefits with commas or new lines."
                >
                  <textarea
                    name="keyBenefits"
                    value={form.keyBenefits}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Example: Hydrates dry skin, lightweight formula, fast absorption, cruelty-free."
                    className="input-style resize-y"
                  />
                </FormField>

                <FormField
                  label="Offer or promotion"
                  helper="Optional. Add a discount, bundle, free shipping or guarantee."
                >
                  <input
                    type="text"
                    name="specialOffer"
                    value={form.specialOffer}
                    onChange={handleChange}
                    placeholder="Example: 20% off the first order and free shipping"
                    className="input-style"
                  />
                </FormField>
              </div>
            </FormSection>

            <div className="border-t border-white/10 bg-[#0d0e11] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-1 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating
                    ? "Preparing your campaign..."
                    : "Generate Complete Campaign"}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-gray-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Clear form
                </button>
              </div>

              <p className="mt-3 text-center text-xs text-gray-500">
                Droxion will analyze your information and generate a complete AI marketing campaign.
              </p>
            </div>
          </form>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#111216] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Campaign readiness
                </p>

                <p className="text-sm font-bold text-blue-400">
                  {completionPercentage}%
                </p>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{
                    width: `${completionPercentage}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                Complete the important product and customer fields to improve
                campaign quality.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111216] p-5">
              <h2 className="text-sm font-semibold text-white">
                Droxion will generate
              </h2>

              <div className="mt-4 space-y-3">
                {campaignOutputs.map((output) => (
                  <div
                    key={output}
                    className="flex items-start gap-3 text-sm text-gray-400"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs text-emerald-400">
                      ✓
                    </span>

                    <span>{output}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
              <p className="text-sm font-semibold text-blue-200">
                Better input = better campaign
              </p>

              <p className="mt-2 text-xs leading-5 text-blue-200/70">
                Be specific about the customer, benefits and offer. Avoid
                generic descriptions such as “high quality” without explaining
                why.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FormSection({ number, title, description, children }) {
  return (
    <section className="border-b border-white/10 p-5 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
          {number}
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function FormField({ label, helper, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>

      {children}

      {helper && (
        <span className="mt-2 block text-xs leading-5 text-gray-500">
          {helper}
        </span>
      )}
    </label>
  );
}
