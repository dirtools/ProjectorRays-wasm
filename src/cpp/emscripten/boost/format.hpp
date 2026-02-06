/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

#ifndef PROJECTORRAYS_EMSCRIPTEN_BOOST_FORMAT_HPP
#define PROJECTORRAYS_EMSCRIPTEN_BOOST_FORMAT_HPP

#include <sstream>
#include <string>
#include <vector>

namespace boost {

class format {
  public:
    explicit format(const std::string &fmt) : _fmt(fmt) {}
    explicit format(const char *fmt) : _fmt(fmt ? fmt : "") {}

    template <typename T> format &operator%(const T &value) {
        std::ostringstream oss;
        oss << value;
        _args.push_back(oss.str());
        return *this;
    }

    std::string str() const {
        std::string out;
        out.reserve(_fmt.size() + 16);
        size_t argIndex = 0;

        for (size_t i = 0; i < _fmt.size(); ++i) {
            char c = _fmt[i];
            if (c != '%') {
                out.push_back(c);
                continue;
            }

            if (i + 1 < _fmt.size() && _fmt[i + 1] == '%') {
                out.push_back('%');
                ++i;
                continue;
            }

            size_t j = i + 1;
            if (j < _fmt.size() && _fmt[j] >= '0' && _fmt[j] <= '9') {
                while (j < _fmt.size() && _fmt[j] >= '0' && _fmt[j] <= '9') {
                    ++j;
                }
                if (j < _fmt.size() && _fmt[j] == '%') {
                    if (argIndex < _args.size()) {
                        out.append(_args[argIndex++]);
                    }
                    i = j;
                    continue;
                }
            }

            while (j < _fmt.size()) {
                char spec = _fmt[j];
                if ((spec >= 'A' && spec <= 'Z') || (spec >= 'a' && spec <= 'z')) {
                    break;
                }
                ++j;
            }
            if (argIndex < _args.size()) {
                out.append(_args[argIndex++]);
            }
            i = j;
        }

        return out;
    }

  private:
    std::string _fmt;
    std::vector<std::string> _args;
};

inline std::ostream &operator<<(std::ostream &os, const format &fmt) { return os << fmt.str(); }

inline std::string str(const format &fmt) { return fmt.str(); }

} // namespace boost

#endif // PROJECTORRAYS_EMSCRIPTEN_BOOST_FORMAT_HPP
