import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ConstrainedFruitVoting = () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fruits = ['Apple', 'Banana', 'Orange', 'Mango', 'Grapes', 'Strawberry', 'Cherry', 'Peach', 'Pear', 'Kiwi'];
  const meals = ['Lunch', 'Dinner'];

  // Initialize users with empty selections
  const initializeUsers = () => {
    const users = {};
    for (let i = 1; i <= 4; i++) {
      users[`User ${i}`] = {};
      days.forEach(day => {
        users[`User ${i}`][day] = {};
        meals.forEach(meal => {
          users[`User ${i}`][day][meal] = '';
        });
      });
    }
    return users;
  };

  const [users, setUsers] = useState(initializeUsers());
  const [selectedUser, setSelectedUser] = useState('User 1');
  const [optimalPlan, setOptimalPlan] = useState({});
  const [constraintStatus, setConstraintStatus] = useState({ violations: [], summary: '' });
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Get available fruits for a specific user/day/meal based on constraints
  const getAvailableFruits = (targetUser, targetDay, targetMeal) => {
    // Count current usage of each fruit for this user
    const userFruitCount = {};
    fruits.forEach(fruit => { 
      userFruitCount[fruit] = 0; 
    });
    
    // Count this user's current selections (excluding the target slot we're changing)
    days.forEach(day => {
      meals.forEach(meal => {
        if (!(day === targetDay && meal === targetMeal)) {
          const selectedFruit = users[targetUser]?.[day]?.[meal];
          if (selectedFruit && selectedFruit !== '') {
            userFruitCount[selectedFruit]++;
          }
        }
      });
    });
    
    // Get same day's other meal selection
    const sameDayOtherMeal = targetMeal === 'Lunch' ? 'Dinner' : 'Lunch';
    const sameDaySelection = users[targetUser]?.[targetDay]?.[sameDayOtherMeal];
    
    // Get previous day's selections
    const dayIndex = days.indexOf(targetDay);
    const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
    const nextDay = dayIndex < days.length - 1 ? days[dayIndex + 1] : null;
    const adjacentDayFruits = [];
    
    if (previousDay) {
      meals.forEach(meal => {
        const prevFruit = users[targetUser]?.[previousDay]?.[meal];
        if (prevFruit && prevFruit !== '') {
          adjacentDayFruits.push(prevFruit);
        }
      });
    }
    
    if (nextDay) {
      meals.forEach(meal => {
        const nextFruit = users[targetUser]?.[nextDay]?.[meal];
        if (nextFruit && nextFruit !== '') {
          adjacentDayFruits.push(nextFruit);
        }
      });
    }
    
    // Filter fruits based on constraints
    return fruits.filter(fruit => {
      // Constraint 1a: No same fruit for lunch AND dinner on same day
      if (sameDaySelection === fruit) {
        return false;
      }
      
      // Constraint 1b: No same fruit on adjacent days
      if (adjacentDayFruits.includes(fruit)) {
        return false;
      }
      
      // Constraint 2: Max 2 times per week
      if (userFruitCount[fruit] >= 2) {
        return false;
      }
      
      return true;
    });
  };

  // Core algorithm: Find optimal plan with constraints
  const findOptimalPlanWithConstraints = () => {
    // Step 1: Count all votes
    const voteCounts = {};
    days.forEach(day => {
      voteCounts[day] = {};
      meals.forEach(meal => {
        voteCounts[day][meal] = {};
        fruits.forEach(fruit => {
          voteCounts[day][meal][fruit] = 0;
        });
      });
    });

    // Count votes from all users
    Object.values(users).forEach(user => {
      days.forEach(day => {
        meals.forEach(meal => {
          const selectedFruit = user[day]?.[meal];
          if (selectedFruit && selectedFruit !== '') {
            voteCounts[day][meal][selectedFruit]++;
          }
        });
      });
    });

    // Step 2: Apply constraint-aware selection
    const plan = {};
    const fruitUsageCount = {};
    const violations = [];
    
    // Initialize fruit usage tracking
    fruits.forEach(fruit => {
      fruitUsageCount[fruit] = 0;
    });

    // Process each day sequentially
    days.forEach((day, dayIndex) => {
      plan[day] = {};
      const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
      
      meals.forEach(meal => {
        const mealVotes = voteCounts[day]?.[meal] || {};
        
        // Sort fruits by vote count (descending)
        const sortedCandidates = Object.entries(mealVotes)
          .sort(([,a], [,b]) => b - a)
          .filter(([,votes]) => votes > 0);
        
        let selectedFruit = null;
        let selectionReason = '';
        let hasViolation = false;
        
        // Try to find a valid fruit
        for (const [fruit, votes] of sortedCandidates) {
          let canSelect = true;
          let violationReason = '';
          
          // Check constraint 1a: No same fruit for lunch AND dinner on same day
          const currentDaySelections = [];
          meals.forEach(m => {
            if (m !== meal) {
              const sameDayFruit = plan[day]?.[m]?.fruit;
              if (sameDayFruit) {
                currentDaySelections.push(sameDayFruit);
              }
            }
          });
          
          if (currentDaySelections.includes(fruit)) {
            canSelect = false;
            violationReason = 'Same day rule';
          }
          
          // Check constraint 1b: No consecutive days
          if (canSelect && previousDay) {
            const prevLunch = plan[previousDay]?.Lunch?.fruit;
            const prevDinner = plan[previousDay]?.Dinner?.fruit;
            if (fruit === prevLunch || fruit === prevDinner) {
              canSelect = false;
              violationReason = 'Consecutive days rule';
            }
          }
          
          // Check constraint 2: Max 2 times per week
          if (canSelect && fruitUsageCount[fruit] >= 2) {
            canSelect = false;
            violationReason = 'Max 2 times per week rule';
          }
          
          if (canSelect) {
            selectedFruit = fruit;
            selectionReason = `${votes} votes, no violations`;
            break;
          } else if (!selectedFruit) {
            violations.push({
              day,
              meal,
              fruit,
              reason: violationReason,
              votes
            });
          }
        }
        
        // If no valid fruit found, pick the most voted one anyway (forced violation)
        if (!selectedFruit && sortedCandidates.length > 0) {
          selectedFruit = sortedCandidates[0][0];
          selectionReason = `Forced selection (${sortedCandidates[0][1]} votes)`;
          hasViolation = true;
        }
        
        // Record selection only if we have a fruit
        if (selectedFruit) {
          plan[day][meal] = {
            fruit: selectedFruit,
            votes: mealVotes[selectedFruit] || 0,
            totalUsers: Object.keys(users).length,
            reason: selectionReason,
            hasViolation: hasViolation
          };
          
          // Update usage counter
          fruitUsageCount[selectedFruit] = (fruitUsageCount[selectedFruit] || 0) + 1;
        } else {
          // No selection made
          plan[day][meal] = {
            fruit: null,
            votes: 0,
            totalUsers: Object.keys(users).length,
            reason: 'No selection',
            hasViolation: false
          };
        }
      });
    });

    return { plan, fruitUsage: fruitUsageCount, violations };
  };

  // Update optimal plan when users change
  useEffect(() => {
    const result = findOptimalPlanWithConstraints();
    setOptimalPlan(result.plan);
    
    // Create constraint status summary
    const overUsed = Object.entries(result.fruitUsage)
      .filter(([, count]) => count > 2)
      .map(([fruit]) => fruit);
    
    const summary = `${result.violations.length} constraint conflicts, ${overUsed.length} fruits over-used`;
    setConstraintStatus({
      violations: result.violations,
      summary: summary,
      fruitUsage: result.fruitUsage
    });
  }, [users]);

  const updateUserSelection = (user, day, meal, fruit) => {
    setUsers(prev => ({
      ...prev,
      [user]: {
        ...prev[user],
        [day]: {
          ...prev[user][day],
          [meal]: fruit
        }
      }
    }));
  };

  const addNewUser = () => {
    const newUserNum = Object.keys(users).length + 1;
    const newUserName = `User ${newUserNum}`;
    
    const newUser = {};
    days.forEach(day => {
      newUser[day] = {};
      meals.forEach(meal => {
        newUser[day][meal] = '';
      });
    });
    
    setUsers(prev => ({
      ...prev,
      [newUserName]: newUser
    }));
  };

  const removeUser = (userToRemove) => {
    if (Object.keys(users).length > 1) {
      const { [userToRemove]: removed, ...remainingUsers } = users;
      setUsers(remainingUsers);
      
      if (selectedUser === userToRemove) {
        setSelectedUser(Object.keys(remainingUsers)[0]);
      }
    }
  };

  const resetAllVotes = () => {
    if (window.confirm('Are you sure you want to clear all user votes?')) {
      setUsers(initializeUsers());
      setSelectedUser('User 1');
    }
  };

  const quickFillRandom = () => {
    const newUsers = { ...users };
    
    Object.keys(newUsers).forEach(userName => {
      days.forEach(day => {
        meals.forEach(meal => {
          const availableFruits = getAvailableFruits(userName, day, meal);
          if (availableFruits.length > 0) {
            const randomFruit = availableFruits[Math.floor(Math.random() * availableFruits.length)];
            newUsers[userName][day][meal] = randomFruit;
          }
        });
      });
    });
    
    setUsers(newUsers);
  };

  const fruitEmojis = {
    'Apple': '🍎', 
    'Banana': '🍌', 
    'Orange': '🍊', 
    'Mango': '🥭', 
    'Grapes': '🍇', 
    'Strawberry': '🍓', 
    'Cherry': '🍒', 
    'Peach': '🍑', 
    'Pear': '🍐', 
    'Kiwi': '🥝'
  };

  // Calculate chart data
  const getChartData = () => {
    const data = fruits.map(fruit => {
      let lunchCount = 0;
      let dinnerCount = 0;
      
      days.forEach(day => {
        if (optimalPlan[day]?.Lunch?.fruit === fruit) lunchCount++;
        if (optimalPlan[day]?.Dinner?.fruit === fruit) dinnerCount++;
      });
      
      return {
        fruit: fruit.slice(0, 6),
        lunch: lunchCount,
        dinner: dinnerCount,
        total: lunchCount + dinnerCount
      };
    });
    
    return data.filter(item => item.total > 0);
  };

  const chartData = getChartData();

  // Calculate total votes cast
  const getTotalVotes = () => {
    let total = 0;
    Object.values(users).forEach(user => {
      days.forEach(day => {
        meals.forEach(meal => {
          if (user[day]?.[meal] && user[day][meal] !== '') {
            total++;
          }
        });
      });
    });
    return total;
  };

  const calculateSatisfactionScore = () => {
    let totalPossibleVotes = 0;
    let satisfiedVotes = 0;
    
    Object.values(users).forEach(user => {
      days.forEach(day => {
        meals.forEach(meal => {
          const userVote = user[day]?.[meal];
          if (userVote && userVote !== '') {
            totalPossibleVotes++;
            const finalSelection = optimalPlan[day]?.[meal]?.fruit;
            if (finalSelection === userVote) {
              satisfiedVotes++;
            }
          }
        });
      });
    });
    
    return totalPossibleVotes > 0 ? Math.round((satisfiedVotes / totalPossibleVotes) * 100) : 0;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
        🍎 Smart Fruit Meal Planner with Constraints
      </h1>
      
      {/* System Status */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-300">
        <h2 className="text-xl font-semibold mb-2 text-blue-800">📋 System Rules & Status:</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-blue-700 mb-2">Constraints:</h3>
            <ul className="list-disc list-inside text-blue-600 space-y-1">
              <li><strong>No Same Day Repeat:</strong> Same fruit cannot be selected for both lunch and dinner on same day</li>
              <li><strong>No Consecutive Days:</strong> Same fruit cannot appear on consecutive days</li>
              <li><strong>Max 2 Times Per Week:</strong> Each fruit can only be selected maximum twice throughout the week</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-blue-700 mb-2">Current Status:</h3>
            <p className="text-blue-600 mb-2">{constraintStatus.summary}</p>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Total Votes: {getTotalVotes()}</div>
              <div className="text-sm text-gray-600">Satisfaction Score: {calculateSatisfactionScore()}%</div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-blue-700 mb-2">Actions:</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button 
                  onClick={addNewUser}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                >
                  ➕ Add User
                </button>
                <span className="bg-blue-200 px-2 py-1 rounded text-blue-800 text-sm">
                  Users: {Object.keys(users).length}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={quickFillRandom}
                  className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors"
                >
                  🎲 Quick Fill
                </button>
                <button 
                  onClick={resetAllVotes}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
                >
                  🗑️ Reset All
                </button>
              </div>
              <button 
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
              >
                {showDebugInfo ? '👁️ Hide Debug' : '🔍 Show Debug'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Interface */}
      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        {/* User Selection */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">👥 Users</h3>
          <div className="space-y-2">
            {Object.keys(users).map(user => (
              <div key={user} className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedUser(user)}
                  className={`flex-1 p-2 rounded text-sm transition-colors ${
                    selectedUser === user 
                      ? 'bg-blue-500 text-white shadow-lg' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {user}
                </button>
                {Object.keys(users).length > 1 && (
                  <button
                    onClick={() => removeUser(user)}
                    className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User Voting Interface */}
        <div className="lg:col-span-3">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">
            🗳️ {selectedUser}'s Preferences
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {days.map(day => (
              <div key={day} className="border rounded-lg p-3 bg-gray-50 shadow-sm">
                <h4 className="font-bold text-center mb-3 text-gray-700">{day}</h4>
                
                {meals.map(meal => (
                  <div key={meal} className="mb-3">
                    <label className="block font-medium text-sm mb-1 text-gray-600">
                      {meal}:
                    </label>
                    <select
                      value={users[selectedUser]?.[day]?.[meal] || ''}
                      onChange={(e) => updateUserSelection(selectedUser, day, meal, e.target.value)}
                      className="w-full p-2 border rounded bg-white text-sm hover:shadow-sm focus:ring-2 focus:ring-blue-300 transition-all"
                    >
                      <option value="">-- Select Fruit --</option>
                      {getAvailableFruits(selectedUser, day, meal).map(fruit => (
                        <option key={fruit} value={fruit}>
                          {fruitEmojis[fruit]} {fruit}
                        </option>
                      ))}
                    </select>
                    
                    <div className="text-xs text-blue-600 mt-1">
                      {getAvailableFruits(selectedUser, day, meal).length} options available
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Optimal Meal Plan - Main Result */}
      <div className="bg-green-50 p-6 rounded-lg mb-8 border-2 border-green-300 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-green-800 text-center">
          🏆 OPTIMAL WEEKLY MEAL PLAN
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {days.map(day => (
            <div key={day} className="bg-white p-4 rounded-lg shadow-sm border">
              <h3 className="font-bold text-center mb-3 text-green-700 text-lg">{day}</h3>
              
              {meals.map(meal => {
                const selection = optimalPlan[day]?.[meal];
                const isViolation = selection?.hasViolation;
                
                return (
                  <div key={meal} className={`mb-2 p-3 rounded-lg transition-all ${
                    !selection?.fruit ? 'bg-gray-100 border border-gray-300' :
                    isViolation ? 'bg-yellow-100 border border-yellow-400 shadow-sm' : 'bg-green-100 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-gray-700">{meal}:</div>
                      {isViolation && <span className="text-yellow-600 text-xs">⚠️</span>}
                    </div>
                    
                    {selection?.fruit ? (
                      <>
                        <div className="text-lg font-bold">
                          {fruitEmojis[selection.fruit]} {selection.fruit}
                        </div>
                        <div className="text-xs text-gray-600">
                          {selection.votes || 0}/{selection.totalUsers || 0} votes
                        </div>
                        {isViolation && (
                          <div className="text-xs text-yellow-700 mt-1">
                            Constraint conflict
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-gray-500 text-sm italic">
                        No votes received
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Debug Information */}
      {showDebugInfo && constraintStatus.violations.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-300">
          <h3 className="text-lg font-semibold mb-3 text-yellow-800">🐛 Constraint Violations Debug</h3>
          <div className="space-y-2">
            {constraintStatus.violations.map((violation, index) => (
              <div key={index} className="bg-white p-2 rounded border border-yellow-200 text-sm">
                <strong>{violation.day} {violation.meal}:</strong> {violation.fruit} 
                ({violation.votes} votes) - blocked by {violation.reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Fruit Usage Chart */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-800">📊 Fruit Usage in Final Plan</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fruit" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="lunch" fill="#3b82f6" name="Lunch" />
              <Bar dataKey="dinner" fill="#8b5cf6" name="Dinner" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usage Statistics */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-800">🎯 Constraint Status</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {fruits.map(fruit => {
              const usage = constraintStatus.fruitUsage?.[fruit] || 0;
              const color = usage > 2 ? 'bg-red-200 border-red-400' : 
                           usage === 2 ? 'bg-yellow-200 border-yellow-400' :
                           usage === 1 ? 'bg-green-200 border-green-400' : 'bg-gray-200';
              
              return (
                <div key={fruit} className={`flex items-center justify-between p-2 rounded border transition-colors ${color}`}>
                  <span className="text-sm font-medium">
                    {fruitEmojis[fruit]} {fruit}
                  </span>
                  <span className="text-sm font-bold">
                    {usage}/2 times
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 text-xs text-gray-600">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
              <span>Over limit (violation)</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 bg-yellow-200 border border-yellow-400 rounded"></div>
              <span>At limit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
              <span>Under limit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConstrainedFruitVoting;