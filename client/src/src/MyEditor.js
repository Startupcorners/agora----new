import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";

// 1. Define the simple React components your user can drag and drop.
// These are just standard React components.
function Heading({ text }) {
  return <h1>{text}</h1>;
}

function Paragraph({ text }) {
  return <p>{text}</p>;
}

function Image({ src }) {
  // We add basic styling to make sure the image is responsive
  return (
    <img
      src={src || "https://puck-editor.com/puck-fallback.svg"}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}

// 2. Create the Puck configuration object.
// This is the most important part. You're telling Puck exactly
// which components are allowed and how the user can edit them.
const config = {
  // You have complete control over the components available to your user.
  // We are NOT including a "Button" component, so it won't be an option.
  components: {
    Heading: {
      // `fields` define the editing interface for the component.
      fields: {
        text: {
          label: "Text",
          type: "text",
        },
      },
      // The `render` function is the React component that will be displayed.
      render: Heading,
    },
    Paragraph: {
      fields: {
        text: {
          label: "Text",
          type: "textarea",
        },
      },
      render: Paragraph,
    },
    Image: {
      fields: {
        src: {
          label: "Image URL",
          type: "text",
        },
      },
      render: Image,
    },
  },
};

// 3. Create your editor component.
// This component will render the Puck editor with your custom configuration.
function MyEditor() {
  // The `onPublish` function is called when the user clicks the "Publish" button.
  // This is where you would save the data to your database.
  const handlePublish = (data) => {
    console.log("Publishing data:", data);
    // Add your save logic here
    // Example: saveToDatabase(data);
  };

  return <Puck config={config} data={{}} onPublish={handlePublish} />;
}

export default MyEditor;
