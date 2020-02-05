(ns metabase.query-processor.util.reducible
  (:require [clojure.core.async :as a]
            [clojure.tools.logging :as log]))

(defn reducible-rows
  "Utility function for generating reducible rows when implementing `metabase.driver/execute-reducible-query`.

  `row-thunk` is a function that, when called, should return the next row in the results, or falsey if no more rows
  exist."
  [row-thunk canceled-chan]
  (reify
    clojure.lang.IReduceInit
    (reduce [_ rf init]
      (loop [acc init]
        (cond
          (reduced? acc)
          @acc

          (a/poll! canceled-chan)
          acc

          :else
          (if-let [row (row-thunk)]
            (recur (rf acc row))
            (do
              (log/trace "All rows consumed.")
              acc)))))))

;; TODO - an impl for QPs that return maps e.g. MongoDB
