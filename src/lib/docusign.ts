import * as docusign from "docusign-esign";
import fs from "fs";

// Environment Variables Required:
// DOCUSIGN_CLIENT_ID (Integration Key)
// DOCUSIGN_USER_ID (Impersonated User GUID)
// DOCUSIGN_PRIVATE_KEY (RSA Private Key string)
// DOCUSIGN_BASE_BATH (e.g., "https://demo.docusign.net/restapi")
// DOCUSIGN_OAUTH_BASE_PATH (e.g., "account-d.docusign.com")

export async function getDocuSignApiClient() {
  const apiClient = new docusign.ApiClient();
  
  const basePath = process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net/restapi";
  const oAuthBasePath = process.env.DOCUSIGN_OAUTH_BASE_PATH || "account-d.docusign.com";
  apiClient.setBasePath(basePath);
  apiClient.setOAuthBasePath(oAuthBasePath);

  const clientId = process.env.DOCUSIGN_CLIENT_ID;
  const userId = process.env.DOCUSIGN_USER_ID;
  const privateKeyString = process.env.DOCUSIGN_PRIVATE_KEY; // Replace \n with actual newlines if stored in JSON

  if (!clientId || !userId || !privateKeyString) {
    throw new Error("Missing Docusign Env Variables. Setup required.");
  }

  // JWT Auth Flow
  const results = await apiClient.requestJWTUserToken(
    clientId,
    userId,
    ["signature", "impersonation"],
    Buffer.from(privateKeyString.replace(/\\n/g, '\n')),
    3600
  );

  apiClient.addDefaultHeader("Authorization", "Bearer " + results.body.access_token);
  
  return apiClient;
}

/**
 * Creates an envelope from HTML and returns the Embedded Signing URL
 */
export async function createEmbeddedSignature(
    accountId: string,
    offerHTML: string,
    candidateEmail: string,
    candidateName: string,
    returnUrl: string
) {
    const apiClient = await getDocuSignApiClient();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);

    // 1. Create Document from HTML
    const document = new docusign.Document();
    document.documentBase64 = Buffer.from(offerHTML).toString("base64");
    document.name = "Employment Offer";
    document.fileExtension = "html";
    document.documentId = "1";

    // 2. Create Signer
    const signer = new docusign.Signer();
    signer.email = candidateEmail;
    signer.name = candidateName;
    signer.recipientId = "1";
    // Setting clientUserId makes this an Embedded Signer (won't send email via DocuSign)
    signer.clientUserId = candidateEmail; 

    // 3. Add Signature Tab
    const signHere = docusign.SignHere.constructFromObject({
        anchorString: "\\s1\\", // Anchor tag to place in HTML: <span style="color:white">\s1\</span>
        anchorYOffset: "10",
        anchorUnits: "pixels",
        anchorXOffset: "20"
    });
    
    // Fallback if anchor string not found, place at bottom right
    const signHereFallback = docusign.SignHere.constructFromObject({
        documentId: "1",
        pageNumber: "1",
        recipientId: "1",
        xPosition: "200",
        yPosition: "600"
    });

    const tabs = new docusign.Tabs();
    tabs.signHereTabs = [signHere]; // Or use fallback depending on template rigidity
    signer.tabs = tabs;

    const recipients = new docusign.Recipients();
    recipients.signers = [signer];

    // 4. Create Envelope
    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = "Please sign your employment offer";
    envelopeDefinition.documents = [document];
    envelopeDefinition.recipients = recipients;
    envelopeDefinition.status = "sent";

    const results = await envelopesApi.createEnvelope(accountId, { envelopeDefinition });
    const envelopeId = results.envelopeId;

    // 5. Generate Recipient View URL (The Embedded iFrame URL)
    const viewRequest = new docusign.RecipientViewRequest();
    viewRequest.returnUrl = returnUrl; 
    viewRequest.authenticationMethod = "none";
    viewRequest.email = candidateEmail;
    viewRequest.userName = candidateName;
    viewRequest.clientUserId = candidateEmail; // Must match exactly

    const view = await envelopesApi.createRecipientView(accountId, envelopeId, { recipientViewRequest: viewRequest });
    
    return { envelopeId, url: view.url };
}
