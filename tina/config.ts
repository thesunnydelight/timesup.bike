import { defineConfig } from "tinacms";

export default defineConfig({
  branch: process.env.TINA_BRANCH || "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "src/assets/gallery",
      publicFolder: "",
    },
  },

  schema: {
    collections: [
      {
        name: "home",
        label: "Home Page",
        path: "src/content",
        match: {
          include: "home",
        },
        format: "json",
        ui: {
          allowedActions: {
            create: false,
            delete: false,
          },
        },
        fields: [
          {
            type: "object",
            name: "hero",
            label: "Hero Section",
            fields: [
              { type: "string", name: "title", label: "Title" },
              {
                type: "string",
                name: "tagline",
                label: "Tagline",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "howItWorks",
            label: "How It Works",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "string",
                name: "text",
                label: "Text",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "helpfulTips",
            label: "Helpful Tips",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "string",
                name: "tips",
                label: "Tips",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "hours",
            label: "Hours",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "string",
                name: "text",
                label: "Text",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "location",
            label: "Location",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "string",
                name: "text",
                label: "Text",
                ui: { component: "textarea" },
              },
            ],
          },
          {
            type: "object",
            name: "contact",
            label: "Contact",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              { type: "string", name: "email", label: "Email" },
            ],
          },
          {
            type: "object",
            name: "socialLinks",
            label: "Social Links",
            fields: [
              { type: "string", name: "instagram", label: "Instagram URL" },
              { type: "string", name: "mapUrl", label: "Map URL" },
            ],
          },
          {
            type: "object",
            name: "gallery",
            label: "Gallery",
            fields: [
              { type: "string", name: "heading", label: "Heading" },
              {
                type: "object",
                name: "images",
                label: "Images",
                list: true,
                ui: {
                  itemProps: (item: Record<string, string>) => ({
                    label: item?.alt || "Image",
                  }),
                },
                fields: [
                  { type: "image", name: "src", label: "Image" },
                  { type: "string", name: "alt", label: "Caption (Alt Text)" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "portraits",
        label: "Bike Portraits",
        path: "src/content",
        match: {
          include: "portraits",
        },
        format: "json",
        ui: {
          allowedActions: {
            create: false,
            delete: false,
          },
        },
        fields: [
          { type: "string", name: "title", label: "Title" },
          { type: "string", name: "description", label: "Description" },
          {
            type: "object",
            name: "portraits",
            label: "Portraits",
            list: true,
            ui: {
              itemProps: (item: Record<string, string>) => ({
                label: item?.alt || "Portrait",
              }),
            },
            fields: [
              { type: "image", name: "src", label: "Image" },
              { type: "string", name: "alt", label: "Caption (Alt Text)" },
              {
                type: "string",
                name: "yearsBiking",
                label: "Years Biking",
                required: false,
              },
              {
                type: "string",
                name: "favoriteCustomization",
                label: "Favorite Customization",
                required: false,
              },
              {
                type: "string",
                name: "typeOfRiding",
                label: "Type of Riding",
                required: false,
              },
            ],
          },
        ],
      },
    ],
  },
});
