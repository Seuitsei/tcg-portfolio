package fr.craftdrop.tcgtest2;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CardCameraPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
