/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Identity API.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Richard Newman <rnewman@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const CLASS_NAME  = "Mozilla Identity Manager";
const CLASS_ID    = Components.ID("{ec8030f7-c20a-464f-9b0e-13a3a9e97384}");
const CONTRACT_ID = "@mozilla.org/services/identity;1";

const SUPPORTED_INTERFACES = [Ci.nsIIdentityManager,
                              //Ci.nsISecurityCheckedComponent,    // Not right now.
                              Ci.nsIClassInfo];

function IdentityManager() {
}
IdentityManager.prototype = {

  _prefsService: Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefService),

  get _defaultProvider() {
    let prefs = this._prefsService.getBranch("services.identity.providers.");
    return prefs.getCharPref("default");
  },
  _defaultProtocol: "http",
  _defaultPath: "/login",
  _blankPath: "/blank.html",

  /*
   * XPCOM nonsense.
   */
  classDescription: CLASS_NAME,
  classID:          CLASS_ID,
  classIDNoAlloc:   CLASS_ID,
  contractID:       CONTRACT_ID,
  QueryInterface:   XPCOMUtils.generateQI(SUPPORTED_INTERFACES),

  /*
   * Bogus method for testing.
   */
  foo: function foo() {
    return "Hello!";
  },

  /*
   * nsIClassInfo methods.
   */
  getInterfaces: function getInterfaces(aCount) {
    let array = SUPPORTED_INTERFACES;
    aCount.value = array.length;
    return array;
  },
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.SINGLETON |
         Ci.nsIClassInfo.DOM_OBJECT |
         Ci.nsIClassInfo.THREADSAFE,

  getHelperForLanguage: function getHelperForLanguage(lang) {
    return null;
  },

  /*
   * Takes as input an array of providers that the RP can handle.
   * Returns three values: an array of providers that the user already uses,
   * an array of providers that they trust but don't use, and the rest.
   */
  _partitionProviders: function _partitionProviders(suggested) {
    dump("Suggested: " + suggested + "\n");
    let acceptable = [];
    let create     = [];
    let unknown    = [];

    if (!suggested.length)
      return [acceptable, create, unknown];

    let existing  = [];                       // TODO: find me.
    let permitted = [this._defaultProvider];  // TODO: find me.

    if (suggested[0] == "*") {
      acceptable = existing.slice();
      create     = permitted.slice();         // TODO: remove existing.
      return [acceptable, create, unknown];
    }

    // Partition the suggested providers.
    suggested.forEach(function (p) {
      if (existing.indexOf(p) != -1)
        acceptable.push(p)
      if (permitted.indexOf(p) != -1)
        create.push(p);
      else
        unknown.push(p);
    });

    return [acceptable, create, unknown];
  },

  /*
   * Create a signin button, attached to an element in the document.
   * 
   * The button, and the iframe it creates, are wrapped in an iframe. This
   * prevents the calling page from messing about with it.
   *
   * Arguments:
   *   providers:  an array of identity provider URIs, or ["*"].
   *   attributes: an array of attributes being requested from the provider.
   *   domObject:  an element in the document. Used as the parent.
   *   callback:   a function of (response), where response has these attributes:
   *     - sid:      the opaque string provided by the caller.
   *     - success:  boolean, true if the authentication operation succeeded.
   *
   *   On success:
   *     - provider: the URI of the selected provider.
   *     - id:       the opaque identifier for this user.
   *     - secret:   an optional additional element of entropy.
   *     - metadata: a key-value map of granted attributes.
   *
   *   On failure:
   *     - error:    a map of code/subcode/message from the upstream provider.
   *
   * This function returns whether a signin button was created.
   *
   * On callback, the response can be verified by making a request to the
   * provider URI with the id and secret.
   */
  createSignInButton:
    function createSignInButton(providers, attributes, domObject, callback) {
      dump("Providers: " + providers + "\n");
      dump("Providers: " + JSON.stringify(providers) + "\n");
      dump("DOM object is " + domObject + "\n");
      dump("Callback is " + callback + "\n");
      if (!domObject)
        return false;

      // Find out which providers are acceptable. Use these in the generated UI.
      let [acceptable, create, unknown] = this._partitionProviders(providers);

      // Compute the URI to use for the innermost iframe.
      let protocol = this._defaultProtocol;
      let provider = this._defaultProvider;
      let innerPath = this._defaultPath;
      let blankPath = this._blankPath;

      function computeIFrameURI(path) {
        return protocol + "://" + provider + path;
      }

      let outerDoc = domObject.ownerDocument;
      let outerWin = outerDoc.defaultView;
      dump("Outer window: " + outerWin + "\n");
      dump("Outer document: " + outerDoc + "\n");

      dump("Creating wrapper iframe.\n");
      let wrapper = outerDoc.createElement("iframe");
      wrapper.id  = "-mozilla-id-iframe";               // Not strictly necessary.
      wrapper.width  = "80";
      wrapper.height = "40";
      
      // Point this somewhere to style the iframe.
      // It also handily provides same-origin protection to the contents of the
      // iframe.
      wrapper.src = computeIFrameURI(blankPath);

      function invokeCallback(response) {
        dump("Origin: " + response.origin + "\n");
        dump("Source: " + response.source + "\n");
        dump("Received message: " + response.data + "\n");
        callback(JSON.parse(response.data));
      }

      function insertChildIFrame() {
        let doc   = wrapper.contentDocument;
        let div   = doc.createElement("div");
        let child = doc.createElement("iframe");
        child.id  = "login";
        child.src = computeIFrameURI(innerPath);
        
        child.width    = "400";
        child.height   = "250";
        wrapper.width  = "440";
        wrapper.height = "300";
        div.appendChild(child);
        doc.body.appendChild(div);
      }

      function setupWrapper() {
        let win = wrapper.contentWindow;
        let doc = wrapper.contentDocument;
        
        // win.postMessage("parent", "*");       // This comes back to us!
        win.addEventListener("message", invokeCallback, true);
          
        // Build a button.
        let button   = doc.createElement("input");
        button.id    = "signinButton";
        button.value = "Sign In";
        button.type  = "button";
        button.addEventListener("click",
            function() {
              insertChildIFrame();
              this.value = "Indeed.";
            },
            true);
        doc.body.appendChild(button);
      }

      // Add a listener to our wrapper iframe. This will call the callback
      // when it receives a PostMessage from the inner iframe.
      wrapper.addEventListener("load", setupWrapper, true);
      domObject.appendChild(wrapper);
    }


  /*
   * nsISecurityCheckedComponent methods.
   * These are commented out for now, because being a DOM_OBJECT makes them
   * irrelevant, but at some point we might want to switch and use these for
   * fine-grained access control.
   */

  /*
  canCreateWrapper: function canCreateWrapper(iid) {
    return (iid.equals(Ci.nsIIdentityManager) && "allAccess") || "noAccess";
  },

  canCallMethod: function canCallMethod(iid, methodName) {
    return (iid.equals(Ci.nsIIdentityManager) &&
            (methodName == "createSignInButton") &&
            "allAccess") || "noAccess";
  },

  canGetProperty: function canGetProperty(iid, propertyName) {
    return "noAccess";
  },

  canSetProperty: function canSetProperty(iid, propertyName) {
    return "noAccess";
  },
   */

};

var IdentityManagerFactory = {
  createInstance: function createInstance(aOuter, aIID) {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return (new IdentityManager()).QueryInterface(aIID);
  }
};

// XPCOM registration.
var IdentityManagerModule = {
  _firstTime: true,

  registerSelf: function registerSelf(aCompMgr, aFileSpec, aLocation, aType) {
    if (this._firstTime) {
      this._firstTime = false;
      throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
    }

    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME,
                                     CONTRACT_ID, aFileSpec, aLocation, aType);
  },

  unregisterSelf: function unregisterSelf(aCompMgr, aLocation, aType) {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);
  },

  getClassObject: function getClassObject(aCompMgr, aCID, aIID) {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return IdentityManagerFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function canUnload(aCompMgr) { return true; }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([IdentityManager]);
