// Jibo voice synthesizer for the simulator.
//
// One-shot:  jibo-speak <voice-dir> <text> <output.wav>
// Daemon:     jibo-speak --daemon <voice-dir>
//   Reads tab-separated "<out.wav>\t<text>" lines on stdin; writes "OK" or "ERR ..." per line.

#include <iostream>
#include <map>
#include <memory>
#include <set>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

#include "jibo-tts-text-engine.h"
#include "jibo-tts-audio-engine.h"
#include "jibo-tts-logger.h"

#include "Poco/Logger.h"

static int synthesise(
    jibo::tts::TextEngine &textEngine,
    jibo::tts::AudioEngine &audioEngine,
    const std::string &text,
    const std::string &outWav) {
  std::unique_ptr<jibo::tts::Utterance> utt = textEngine.getUttWithLabels(
      const_cast<std::string *>(&text));
  if (!utt) {
    std::cerr << "failed to build utterance\n";
    return 2;
  }
  if (!audioEngine.synthesiseFromUtt(utt.get(), outWav, true)) {
    std::cerr << "synthesis failed\n";
    return 3;
  }
  return 0;
}

static void initLogger() {
  Poco::Logger &pocoLog = Poco::Logger::get("jibo-speak");
  jibo::tts::Logger::setLogger(&pocoLog);
}

static int runDaemon(const std::string &voiceDir) {
  initLogger();
  try {
    auto resources = std::make_shared<jibo::tts::LanguageResource>(
        const_cast<std::string *>(&voiceDir));
    jibo::tts::TextEngine textEngine(resources);
    jibo::tts::AudioEngine audioEngine(resources);

    std::cout << "READY" << std::endl;

    std::string line;
    while (std::getline(std::cin, line)) {
      if (line.empty()) {
        continue;
      }
      if (line == "PING") {
        std::cout << "PONG" << std::endl;
        continue;
      }

      const size_t tab = line.find('\t');
      if (tab == std::string::npos) {
        std::cout << "ERR bad request format" << std::endl;
        continue;
      }

      const std::string outWav = line.substr(0, tab);
      const std::string text = line.substr(tab + 1);
      const int rc = synthesise(textEngine, audioEngine, text, outWav);
      if (rc == 0) {
        std::cout << "OK" << std::endl;
      } else {
        std::cout << "ERR synthesis failed" << std::endl;
      }
    }
    return 0;
  } catch (const std::exception &e) {
    std::cerr << "daemon error: " << e.what() << "\n";
    return 4;
  }
}

int main(int argc, char **argv) {
  if (argc >= 3 && std::string(argv[1]) == "--daemon") {
    return runDaemon(std::string(argv[2]));
  }

  if (argc < 4) {
    std::cerr << "usage: " << argv[0] << " <voice-dir> <text> <output.wav>\n"
              << "       " << argv[0] << " --daemon <voice-dir>\n";
    return 1;
  }

  initLogger();

  std::string voiceDir(argv[1]);
  std::string text(argv[2]);
  std::string outWav(argv[3]);

  try {
    auto resources = std::make_shared<jibo::tts::LanguageResource>(&voiceDir);
    jibo::tts::TextEngine textEngine(resources);
    jibo::tts::AudioEngine audioEngine(resources);

    const int rc = synthesise(textEngine, audioEngine, text, outWav);
    if (rc != 0) {
      return rc;
    }

    std::cout << outWav << std::endl;
    return 0;
  } catch (const std::exception &e) {
    std::cerr << "error: " << e.what() << "\n";
    return 4;
  } catch (...) {
    std::cerr << "unknown error\n";
    return 5;
  }
}
