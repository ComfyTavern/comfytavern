# How to Add or Update UI Language Packs for ComfyTavern

ComfyTavern supports user-defined interface languages. By adding custom language packs, you can translate the application's UI into your preferred language or override existing translations. This document will guide you through the process of creating, applying, and maintaining custom language packs.

## Prerequisites

- You need to be able to access ComfyTavern's file system, especially user-specific file directories. This is usually done through the in-app file manager or by direct file system access.
- If you are a developer and wish to generate the latest translation templates, you need to set up ComfyTavern's development environment locally and have `bun` installed.

## Steps Overview

1.  **Obtain or Generate Language Pack Template**: Use a pre-built template or generate the latest template file via script.
2.  **Create and Translate Language Pack**: Create your language JSON file based on the template and complete the translation.
3.  **Place Language Pack File**: Place the created JSON file into the user or shared language pack directory.
4.  **Select New Language in App**: Select and apply your custom language in ComfyTavern's settings.

## Detailed Steps

### Step 1: Create Language Pack JSON File

Your custom language pack must be a JSON file, and its content needs to follow a specific structure.

#### a. File Naming

File names should follow BCP 47 language code conventions and end with `.json`. For example:

-   French (France): `fr-FR.json`
-   Korean (Korea): `ko-KR.json`
-   Spanish (Spain): `es-ES.json`

#### b. File Content Structure

Each language pack JSON file **must** contain a top-level `_meta` object to describe the language pack. The `_meta` object includes the following fields:

-   `name` (string): English name of the language (e.g., "French (France)").
-   `nativeName` (string): Native name of the language (e.g., "Français (France)").

#### c. Obtain Translation Template and Translate

In addition to the `_meta` object, the rest of the file should contain the key-value pairs you want to translate. **It is highly recommended to use the template provided by the project as a starting point to ensure coverage of all necessary translation keys.**

We provide an automated scanning script [`scripts/i18n-scanner.ts`](../../scripts/i18n-scanner.ts) to extract all translatable text keys from the source code and generate a template file.

**For regular users:**
You can directly use the pre-built template file in the project: [`scripts/locales-template.json`](../../scripts/locales-template.json).
This file contains all UI text keys, and a `_meta` structure for you to fill in, with all values being `"[TODO]"`. What you need to do is:
1.  Copy the content of [`scripts/locales-template.json`](../../scripts/locales-template.json).
2.  Create a new file named according to the naming convention above (e.g., `fr-FR.json`).
3.  Paste the copied content into it, then modify the placeholder in the `_meta` object to the actual name of your language.
4.  Translate all other keys with `"[TODO]"` values into your target language.

**For developers:**
If you want to get the latest template, you can run the scanning script. See the "Developer Guide" section for details.

#### d. Example `fr-FR.json`

This is an example of a French language pack translated from the template.

```json
{
  "_meta": {
    "name": "French (France)",
    "nativeName": "Français (France)"
  },
  "common": {
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "[TODO]"
    // ... other common translations ...
  },
  "nav": {
    "home": "Accueil",
    "editor": "Éditeur",
    "settings": "[TODO]"
    // ... other navigation translations ...
  }
  // ... more translation keys ...
}
```

**Important Note:**
- Ensure your JSON file is correctly formatted.
- The hierarchical structure of translation keys should be consistent with the template.
- If you only want to override partial translations, just provide the keys you want to modify in your custom language pack. The system will merge your translations with built-in translations.

### Step 2: Place Language Pack File

After creating the language pack JSON file, you need to place it in ComfyTavern's user language pack directory. This directory is usually located at:

- Path for internal file manager: `user://library/locales/ui/@ComfyTavern-ui/` or `userData\{UID}\library\locales\ui\@ComfyTavern-ui`

You can use ComfyTavern's built-in file manager to navigate to this path and upload your JSON file. If the directory does not exist, you may need to create it manually.

For example, if you created `fr-FR.json`, you should place it as:
`user://library/locales/ui/@ComfyTavern-ui/fr-FR.json`

You can also place language pack files in the shared directory `shared://library/locales/ui/@ComfyTavern-ui/` or `public\library\locales\ui\@ComfyTavern-ui`, so that other users accessing this deployment instance can use these language packs.

### Step 3: Select New Language in App

After placing the language pack file:

1.  **Restart ComfyTavern** or **refresh the browser page**. This will trigger the application to rediscover available language packs.
2.  Go to the application's **Settings** interface.
3.  Find **Interface Language** or a similar option.
4.  Your custom language (displayed by its `nativeName`) should appear in the language selection list.
5.  Select your language, and the application should switch to the new language.

If your language does not appear, please check:
-   Whether the JSON file name and path are correct.
-   Whether the JSON file content is valid, especially the `_meta` section.
-   Whether the file manager has correctly synchronized the file.

## Developer Guide: Using Scripts to Generate and Update Language Packs

To facilitate developers and contributors in maintaining language packs, we provide a powerful scanning tool: [`scripts/i18n-scanner.ts`](../../scripts/i18n-scanner.ts).

### Script Functionality

This script automatically scans all `.vue` and `.ts` files in the frontend, extracts all translatable text keys, and performs the following operations:

1.  **Generates the latest translation template**: Creates a clean template containing all keys in `scripts/locales-template.json`.
2.  **Processes built-in language packs**: Updates core developer-maintained language packs (located in `apps/frontend-vueflow/src/locales`) and outputs the merged product to `scripts/merged_locales/built-in/`.
3.  **Processes extended language packs**: Updates your custom language packs placed in the `locales-extensions` directory and outputs the merged product to `locales-extensions/merged_locales/`.

### How to Use the Script to Update Your Custom Language Pack

This is a two-step process: first use the script to update the file, then deploy the updated file to the application.

#### Step A: Use the Script to Generate Merged Files

1.  **Place Your Files**: Place your language pack file (e.g., `my-lang.json`) that you are translating in the `locales-extensions` folder at the project root.
2.  **Run Scan Script**: In the project root directory, open the terminal and execute:
    ```bash
    bun run i18n:scan
    ```
3.  **Get Updated Files**: After the script execution, find the updated file (e.g., `my-lang.json`) in the `locales-extensions/merged_locales/` directory. This file now contains all the latest translation keys, while retaining your completed translations.

#### Step B: Make Language Pack Effective in the App

**The `locales-extensions` directory is only for script processing convenience; the application itself does not load files from it.**

To make your language pack effective, you must complete the final step:

-   **Copy** the final file obtained in **Step A**, located in `locales-extensions/merged_locales/`, to one of the runtime directories described in "**Step 2: Place Language Pack File**" (e.g., `user://library/locales/ui/@ComfyTavern-ui/`).

After completing this copy operation and refreshing the application, your custom language will appear in the settings menu.

## Advanced: Translation Overrides and Merging

ComfyTavern's language loading mechanism has hierarchical and merging characteristics:

1.  **Loading Order and Priority**:
    *   **Built-in Language Packs**: Loaded as the base.
    *   **Shared Language Packs** (`shared://library/locales/ui/@ComfyTavern-ui/`): Overwrites built-in translations if present.
    *   **User Language Packs** (`user://library/locales/ui/@ComfyTavern-ui/`): Has the highest priority, overwriting shared and built-in translations.

2.  **Merging Logic**:
    *   When loading a language (e.g., your custom language `fr-FR`), the system first loads the built-in version of that language (if it exists), then the shared version, and finally the user version.
    *   For the same translation key, the value in the later loaded language pack will overwrite the earlier one.
    *   This means you don't have to provide all translations in your custom language pack. You only need to provide the translations you want to add or modify. Keys not defined in your file will fall back to the shared or built-in version.

For example, if the built-in `en-US.json` has `common.save: "Save"`, and your `user://.../en-US.json` defines `common.save: "Save Changes"`, the interface will display "Save Changes". If your file does not define `common.cancel`, the built-in "Cancel" will be used.

## Troubleshooting

-   **Language not displayed in the list**:
    -   Check JSON file name and path.
    -   Verify JSON format validity (you can use an online JSON validator).
    -   Ensure `_meta.name` and `_meta.nativeName` are correctly filled.
-   **Some text not translated**:
    -   Check if your language pack contains the corresponding translation keys.
    -   Ensure the hierarchical structure of translation keys is consistent with official language packs or templates.
-   **Console errors**:
    -   Open the browser developer console and check for any error messages related to language file loading or parsing.

By following these steps, you should be able to successfully add and apply custom UI language packs for ComfyTavern. Happy using!