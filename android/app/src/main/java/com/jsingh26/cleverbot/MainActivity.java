package com.jsingh26.cleverbot;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
