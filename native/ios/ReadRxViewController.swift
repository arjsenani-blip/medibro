import Capacitor

/// Capacitor's web view, plus ReadRx's own native plugins.
class ReadRxViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LabelReaderPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
        bridge?.registerPluginInstance(ListenPlugin())
    }
}
