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
  _defaultProvider: "web4.dev.svc.mtv1.mozilla.com",

  // We get a security error when this is loaded... but then everything works fine.
  // Puzzling.
  _defaultIFrameSrc: "chrome://identity/content/buttonframe.html",

  // An alternative approach... that doesn't actually allow us to fiddle with the
  // contents.
  //_defaultIFrameSrc: "data:text/html,<html><head></head><body>Hello!</body></html>",

  /*
   * When we sub in a login page, this is where we go.
   */
  _blankIFrameSrc: "http://twinql.com/login/blank.html",
  //_blankIFrameSrc: "file:///Users/rnewman/moz/git/identity/snippets/blank.html",

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

      let blank = this._blankIFrameSrc;
      function computeIFrameURI() {
        return blank;
      }
      let outerDoc = domObject.ownerDocument;
      let outerWin = outerDoc.defaultView;
      dump("Outer window: " + outerWin + "\n");
      dump("Outer document: " + outerDoc + "\n");
      function insertIFrame() {
        
        dump("Creating wrapper iframe.\n");
        let wrapper     = outerDoc.createElement("iframe");
        let src         = computeIFrameURI();
        dump("src is " + src + "\n");
        wrapper.src     = src;
        
        function waveHello() {
          dump("win ...\n");
          let win = wrapper.contentWindow;
          dump("win is " + win + "\n");
          win.postMessage("parent", "*");
          dump("Message sent. \n");
          win.addEventListener("message", invokeCallback, true);
        }
        
        wrapper.addEventListener("load", waveHello, true);
        domObject.appendChild(wrapper);
        
        /*
        let wrapperDoc = wrapper.contentDocument;
        let body       = wrapperDoc.createElement("body");
        wrapperDoc.body = body;
        */
        /*
        let img    = wrapperDoc.createElement("img");
        img.src    = "http://twinql.com/jpg/edc_201012.jpg";
        img.width  = 200;
        img.height = 200;
        wrapperDoc.body.appendChild(img);
        */
        
        /*
        let iframe      = wrapperDoc.createElement("iframe");
        dump("Adding child iframe." + "\n");
        wrapperDoc.body.appendChild(iframe);
        iframe.src      = src;
        */
        
        // Add a listener to our wrapper iframe. This will call the callback
        // when it receives a PostMessage from the inner iframe.
        function invokeCallback(response) {
          dump("Origin: " + response.origin + "\n");
          dump("Source: " + response.source + "\n");
          dump("Received message: " + response.data + "\n");
          //callback("Received message: " + response.data);
        }
        outerWin.addEventListener("message", invokeCallback, true);
      }

      // Build a button.
      let button   = outerDoc.createElement("input");
      button.value = "Sign In";
      button.type  = "button";
      button.addEventListener("click",
          function() {
            insertIFrame();
            this.value = "Indeed.";
          },
          true);

      // Wire everything together.
      domObject.appendChild(button);
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
