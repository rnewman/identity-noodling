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

const CLASS_NAME = "Mozilla Identity Manager";
const CLASS_ID = Components.ID("{ec8030f7-c20a-464f-9b0e-13a3a9e97384}");
const CONTRACT_ID = "@mozilla.org/services/identity;1";

function IdentityManager() {
  //this.wrappedJSObject = this;
}
IdentityManager.prototype = {
  _defaultProvider: "web4.dev.svc.mtv1.mozilla.com",
  
  classDescription: CLASS_NAME,
  classID:          CLASS_ID,
  contractID:       CONTRACT_ID,
  QueryInterface:   XPCOMUtils.generateQI([Ci.nsIIdentityManager,
                                           Ci.nsISecurityCheckedComponent,
                                           Ci.nsIClassInfo]),
  
  /*
   * nsIClassInfo methods.
   */
  getInterfaces: function getInterfaces(aCount) {
    let array = [Ci.nsIIdentityManager,
                 Ci.nsISecurityCheckedComponent,
                 Ci.nsIClassInfo];
    aCount.value = array.length;
    return array;
  },
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: Ci.nsIClassInfo.SINGLETON,

  xpcom_categories: [{category: "JavaScript global property", entry: "identity"}],

  /*
   * nsISecurityCheckedComponent methods.
   */
  
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
  
  /*
   * Takes as input an array of providers that the RP can handle.
   * Returns three values: an array of providers that the user already uses,
   * an array of providers that they trust but don't use, and the rest.
   */
  _partitionProviders: function _partitionProviders(suggested) {
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
   *   domID:      the ID of an element in the document. Used as the parent.
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
    function createSignInButton(providers, attributes, domID, callback) {
      if (!document)
        throw "Cannot operate in a non-document context.";
      
      // Find out which providers are acceptable. Use these in the generated UI.
      let [acceptable, create, unknown] = this._partitionProviders(providers);
      
      // Build a button.
      let parent = document.getElementById(domID);
      
      if (!parent)
        return false;
      
      let button = document.createElement("input");
      button.name = "Sign In";
      button.type = "button";
      button.onclick = function() {
        alert(JSON.stringify([acceptable, create, unknown]));
      }
      
      // TODO: iframe.
      parent.appendChild(button);
    }
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
