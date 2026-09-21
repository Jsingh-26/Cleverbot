package com.jsingh26.cleverbot;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.appdistribution.FirebaseAppDistribution;

@CapacitorPlugin(name = "CleverbotUpdates")
public class UpdatePlugin extends Plugin {
    @PluginMethod
    public void checkForUpdates(PluginCall call) {
        FirebaseAppDistribution.getInstance()
            .updateIfNewReleaseAvailable()
            .addOnSuccessListener(release -> {
                JSObject result = new JSObject();
                result.put("updateAvailable", release != null);
                call.resolve(result);
            })
            .addOnFailureListener(error -> call.reject(
                "Could not check for updates. Sign in with the invited tester Google account and try again.",
                error
            ));
    }
}
