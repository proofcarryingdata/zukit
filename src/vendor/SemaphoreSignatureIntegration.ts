import { openZupassPopup } from "./PassportPopup";

/**
 * Opens a Zupass popup to generate a Semaphore signature proof on the user's
 * Zuzalu DB uuid and website referer, which can then be used to fetch user details
 * from the Zupass server, and ensure that the sign in signature was meant for this
 * website. Built specifically for Zuzalu apps.
 *
 * @param zupassClientUrl URL of the Zupass client
 * @param popupUrl Route where the useZupassPopupSetup hook is being served from
 * @param originalSiteName Name of site requesting proof
 */
export function openSignedZuzaluSignInPopup(
  zupassClientUrl: string,
  popupUrl: string,
  originalSiteName: string
) {
  const requestParamValue = {
    type: "Get",
    returnUrl: popupUrl,
    args: {
      identity: {
        argumentType: "PCD",
        pcdType: "semaphore-identity-pcd",
        userProvided: true,
      },
      signedMessage: {
        argumentType: "String",
        userProvided: true,
        value: undefined,
      },
    },
    pcdType: "semaphore-signature-pcd",
    options: {
      title: "Zuzalu Auth",
      description: originalSiteName,
      signIn: true,
    },
  };

  const search = `request=${encodeURIComponent(
    JSON.stringify(requestParamValue)
  )}`;
  const proofUrl = `${zupassClientUrl}/#/prove?${search}`;

  openZupassPopup(popupUrl, proofUrl);
}
